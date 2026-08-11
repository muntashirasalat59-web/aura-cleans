const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const { assertNoError } = require('../database/supabase');
const { registerInvoiceFonts } = require('../utils/pdfInvoice');
const { renderPremiumInvoicePdf } = require('../utils/renderInvoicePdf');
const { fetchBusinessSettings } = require('../utils/businessSettings');
const {
  pickPaymentPayload,
  resolveAmountPaid,
  resolvePaymentStatus,
  enrichPaymentFields,
} = require('../utils/salePayment');
const {
  parseInvoiceSuffix,
  nextInvoiceNumberFromRows,
  isDuplicateInvoiceNumberError,
} = require('../utils/invoiceNumber');
const { logActivity } = require('../utils/activityLog');

function paymentForDb(paymentRow) {
  if (!paymentRow) return {};
  const { _collection, ...rest } = paymentRow;
  return rest;
}
const { rollbackSale } = require('../utils/saleRollback');
const { formatSaleDeleteMessage } = require('../utils/stockMessages');
const { createSaleDirect, updateSaleDirect } = require('../utils/createSaleDirect');
const { buildInvoicePdfBuffer } = require('../utils/invoicePdfBuffer');
const {
  normalizeIndiaWhatsAppPhone,
  buildWhatsAppInvoiceMessage,
  buildWhatsAppShareUrl,
  uploadInvoicePdf,
} = require('../utils/whatsappShare');

async function generateInvoiceNumber(db, atLeast = 0) {
  const year = new Date().getFullYear();
  const minSuffix = Number(atLeast) || 0;

  try {
    const { data: rpcNumber, error: rpcError } = await db.rpc('next_sales_invoice_number', {
      p_year: year,
    });
    if (!rpcError && rpcNumber) {
      const suffix = parseInvoiceSuffix(rpcNumber);
      if (suffix > minSuffix) {
        console.log(`[sales] next invoice number=${rpcNumber} (via RPC)`);
        return String(rpcNumber);
      }
    }
  } catch {
    /* RPC not installed yet */
  }

  const { data, error } = await db
    .from('sales')
    .select('invoice_number')
    .like('invoice_number', `INV-${year}-%`);

  assertNoError(error);

  const next = nextInvoiceNumberFromRows(data || [], minSuffix, year);
  console.log(
    `[sales] next invoice number=${next} (atLeast=${minSuffix}, scanned=${(data || []).length})`
  );
  return next;
}

async function createSaleWithUniqueInvoice(db, body, gstRate, maxAttempts = 5) {
  let lastTriedSuffix = 0;
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const invoiceNumber = await generateInvoiceNumber(db, lastTriedSuffix);
    lastTriedSuffix = parseInvoiceSuffix(invoiceNumber);
    console.log(`[sales] create attempt ${attempt + 1}/${maxAttempts} invoice=${invoiceNumber}`);
    try {
      const saleId = await createSaleWithPayment(db, body, invoiceNumber, gstRate);
      return { saleId, invoiceNumber };
    } catch (error) {
      lastError = error;
      console.warn(
        `[sales] create failed for ${invoiceNumber}:`,
        error.message,
        isDuplicateInvoiceNumberError(error) ? '(duplicate — retry)' : ''
      );
      if (!isDuplicateInvoiceNumberError(error) || attempt === maxAttempts - 1) {
        throw error;
      }
    }
  }

  throw lastError;
}

function mapSaleRow(row) {
  const party = row.parties;
  const items = row.sale_items || [];
  const { parties, sale_items, ...rest } = row;
  const total_quantity = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const mapped = {
    ...rest,
    party_name: party?.name,
    party_type: party?.type,
    contact: party?.contact,
    address: party?.address,
    gst_number: party?.gst_number,
    total_quantity,
  };
  Object.assign(mapped, enrichPaymentFields(mapped));
  return mapped;
}

async function fetchSaleWithItems(db, saleId) {
  const { data: sale, error: saleError } = await db
    .from('sales')
    .select('*, parties(name, type, contact, address, gst_number)')
    .eq('id', saleId)
    .eq('is_deleted', false)
    .single();

  assertNoError(saleError);

  const { data: items, error: itemsError } = await db
    .from('sale_items')
    .select('*, products(name, hsn_sac, unit_size, unit_type)')
    .eq('sale_id', saleId);

  assertNoError(itemsError);

  const mapped = mapSaleRow(sale);
  mapped.items = (items || []).map((row) => ({
    ...row,
    product_name: row.products?.name,
    hsn_sac: row.products?.hsn_sac || '',
    unit_size: row.products?.unit_size,
    unit_type: row.products?.unit_type,
    products: undefined,
  }));
  mapped.total_quantity = mapped.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  return mapped;
}

async function saveSalePayment(db, saleId, body) {
  const paymentRow = pickPaymentPayload(body);
  const { data: sale, error: saleError } = await db
    .from('sales')
    .select('total_amount')
    .eq('id', saleId)
    .single();
  assertNoError(saleError);

  const amount_paid = resolveAmountPaid(paymentRow, sale?.total_amount);
  const payment_status = resolvePaymentStatus(amount_paid, sale?.total_amount);
  const payment_due_date =
    payment_status === 'paid' ? null : paymentRow.payment_due_date || null;

  const {
    amount_paid: _ignoredPaid,
    payment_status: _ignoredStatus,
    payment_due_date: _ignoredDue,
    _collection,
    ...paymentFields
  } = paymentRow;

  const full = {
    ...paymentFields,
    amount_paid,
    payment_status,
    payment_due_date,
  };

  const attempts = [
    full,
    (({ payment_status, ...rest }) => rest)(full),
    (({ payment_status, amount_paid, ...rest }) => rest)(full),
    {
      payment_due_date,
      payment_bank_name: paymentFields.payment_bank_name,
      payment_account_number: paymentFields.payment_account_number,
      payment_upi: paymentFields.payment_upi,
      payment_terms: paymentFields.payment_terms,
    },
    { payment_due_date },
  ];

  let lastError = null;
  for (const patch of attempts) {
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined)
    );
    if (!Object.keys(clean).length) continue;
    const { error } = await db.from('sales').update(clean).eq('id', saleId);
    if (!error) return;
    lastError = error;
    if (!/column|schema cache|could not find|does not exist/i.test(error.message || '')) break;
  }
  assertNoError(lastError);
}

function isMissingSaleRpcError(error) {
  const msg = (error?.message || '').toLowerCase();
  return (
    msg.includes('could not find the function') ||
    msg.includes('does not exist') ||
    msg.includes('apply_sale_payment_from_json')
  );
}

async function createSaleWithPayment(db, body, invoiceNumber, gstRate) {
  const paymentRow = paymentForDb(pickPaymentPayload(body));

  const { data, error } = await db.rpc('create_sale', {
    p_party_id: body.party_id,
    p_invoice_number: invoiceNumber,
    p_invoice_date: body.invoice_date,
    p_gst_percent: gstRate,
    p_items: body.items,
    p_payment: paymentRow,
  });

  if (error && isMissingSaleRpcError(error)) {
    console.warn(
      '[sales] create_sale RPC unavailable — using direct create:',
      error.message
    );
    return createSaleDirect(db, body, invoiceNumber, gstRate);
  }

  assertNoError(error);
  try {
    await saveSalePayment(db, data, body);
  } catch (paymentErr) {
    if (!/amount_paid|payment_status|payment_/i.test(paymentErr.message || '')) throw paymentErr;
    console.warn('[sales] saveSalePayment after create:', paymentErr.message);
  }
  return data;
}

async function updateSaleWithPayment(db, saleId, body, gstRate) {
  const paymentRow = paymentForDb(pickPaymentPayload(body));

  const { data, error } = await db.rpc('update_sale', {
    p_sale_id: Number(saleId),
    p_party_id: body.party_id,
    p_invoice_date: body.invoice_date,
    p_gst_percent: gstRate,
    p_items: body.items,
    p_payment: paymentRow,
  });

  if (error && isMissingSaleRpcError(error)) {
    console.warn(
      '[sales] update_sale RPC unavailable — using direct update:',
      error.message
    );
    return updateSaleDirect(db, saleId, body, gstRate);
  }

  assertNoError(error);
  try {
    await saveSalePayment(db, saleId, body);
  } catch (paymentErr) {
    if (!/amount_paid|payment_/i.test(paymentErr.message || '')) throw paymentErr;
    console.warn('[sales] saveSalePayment after update:', paymentErr.message);
  }
  return data;
}

router.get('/', async (req, res) => {
  try {
    const { data, error } = await req.db
      .from('sales')
      .select('*, parties(name, type), sale_items(quantity)')
      .eq('is_deleted', false)
      .order('invoice_date', { ascending: false });

    assertNoError(error);
    res.json((data || []).map(mapSaleRow));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/pdf', async (req, res) => {
  try {
    const sale = await fetchSaleWithItems(req.db, req.params.id);
    const business = await fetchBusinessSettings(req.accessToken, req.profile?.business_id);

    const doc = new PDFDocument({ margin: 50 });
    registerInvoiceFonts(doc);
    doc.font('InvoiceRegular');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${sale.invoice_number}.pdf"`);

    doc.pipe(res);

    renderPremiumInvoicePdf(doc, sale, business);

    doc.end();
  } catch (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sales/:id/whatsapp-share
 * Generate PDF → upload to public "invoices" bucket → return WhatsApp deep link.
 */
router.post('/:id/whatsapp-share', async (req, res) => {
  try {
    const sale = await fetchSaleWithItems(req.db, req.params.id);
    const phone = normalizeIndiaWhatsAppPhone(sale.contact);

    if (!phone) {
      return res.status(400).json({
        error: 'Party ka contact number add karo pehle',
        code: 'PARTY_CONTACT_MISSING',
      });
    }

    const business = await fetchBusinessSettings(req.accessToken, req.profile?.business_id);
    const pdfBuffer = await buildInvoicePdfBuffer(sale, business);
    const pdfUrl = await uploadInvoicePdf({
      businessId: req.profile?.business_id,
      saleId: sale.id,
      invoiceNumber: sale.invoice_number,
      pdfBuffer,
    });

    const message = buildWhatsAppInvoiceMessage({
      invoiceNumber: sale.invoice_number,
      amount: sale.total_amount,
      pdfUrl,
      partyName: sale.party_name,
    });
    const whatsappUrl = buildWhatsAppShareUrl(phone, message);

    res.json({
      whatsappUrl,
      pdfUrl,
      phone,
      invoice_number: sale.invoice_number,
      total_amount: sale.total_amount,
    });
  } catch (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.status(500).json({ error: error.message || 'Failed to prepare WhatsApp share' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const sale = await fetchSaleWithItems(req.db, req.params.id);
    res.json(sale);
  } catch (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/mark-paid', async (req, res) => {
  try {
    const saleId = Number(req.params.id);
    if (!saleId) return res.status(400).json({ error: 'Invalid invoice id' });

    const method = String(req.body?.payment_method || 'Cash').trim();
    if (!['Cash', 'Bank', 'UPI'].includes(method)) {
      return res.status(400).json({ error: 'payment_method must be Cash, Bank, or UPI' });
    }

    const paymentDate =
      String(req.body?.payment_date || '').trim() || new Date().toISOString().slice(0, 10);

    const db = req.db;
    const { data: sale, error: saleError } = await db
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .eq('is_deleted', false)
      .single();
    assertNoError(saleError);

    const total = Number(sale.total_amount) || 0;
    const noteLine = `Paid on ${paymentDate} via ${method}`;
    const prevTerms = (sale.payment_terms || '').trim();
    const payment_terms = prevTerms.includes('Paid on ')
      ? prevTerms
      : prevTerms
        ? `${prevTerms}\n${noteLine}`
        : noteLine;

    const fullPatch = {
      payment_status: 'paid',
      amount_paid: total,
      payment_due_date: null,
      payment_terms,
    };

    const attempts = [
      fullPatch,
      { amount_paid: total, payment_due_date: null, payment_terms },
      { payment_due_date: null, payment_terms },
      { payment_due_date: null },
    ];

    let lastError = null;
    let applied = null;
    for (const patch of attempts) {
      const { error } = await db.from('sales').update(patch).eq('id', saleId);
      if (!error) {
        applied = patch;
        break;
      }
      lastError = error;
      if (!/column|schema cache|could not find|does not exist/i.test(error.message || '')) {
        break;
      }
    }
    if (!applied) {
      assertNoError(lastError);
      return res.status(500).json({ error: 'Failed to mark invoice as paid' });
    }

    const prior = enrichPaymentFields(sale);
    const clearAmount = prior.balance_due > 0 ? prior.balance_due : 0;
    if (clearAmount > 0 && sale.party_id) {
      try {
        const { data: party, error: partyErr } = await db
          .from('parties')
          .select('id, balance')
          .eq('id', sale.party_id)
          .maybeSingle();
        assertNoError(partyErr);
        if (party) {
          const nextBalance = Math.round((Number(party.balance || 0) - clearAmount) * 100) / 100;
          const { error: balErr } = await db
            .from('parties')
            .update({ balance: nextBalance })
            .eq('id', party.id);
          assertNoError(balErr);
        }
      } catch (balError) {
        console.warn('[sales.mark-paid] party balance update failed:', balError.message);
      }
    }

    const updated = await fetchSaleWithItems(db, saleId);
    await logActivity(req, {
      actionType: 'mark_paid',
      entityType: 'sale',
      entityId: saleId,
      entityName: updated?.invoice_number || `Sale #${saleId}`,
      details: {
        payment_method: method,
        payment_date: paymentDate,
        amount: total,
        party_name: updated?.party_name,
      },
    });
    res.json({
      ...updated,
      message: `${updated.invoice_number} marked as paid`,
      payment_method: method,
      payment_date: paymentDate,
    });
  } catch (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.status(500).json({ error: error.message || 'Failed to mark invoice as paid' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { party_id, invoice_date, gst_percent, items } = req.body;

    if (!party_id || !invoice_date || !items || items.length === 0) {
      return res.status(400).json({ error: 'Party, date and items are required' });
    }

    const gstRate = gst_percent || 18;
    const { saleId } = await createSaleWithUniqueInvoice(req.db, req.body, gstRate);

    const sale = await fetchSaleWithItems(req.db, saleId);
    await logActivity(req, {
      actionType: 'create',
      entityType: 'sale',
      entityId: saleId,
      entityName: sale?.invoice_number || `Sale #${saleId}`,
      details: {
        party_name: sale?.party_name,
        total_amount: sale?.total_amount,
        payment_status: sale?.payment_status,
      },
    });
    res.status(201).json(sale);
  } catch (error) {
    if (isDuplicateInvoiceNumberError(error)) {
      return res.status(409).json({
        error: 'Something went wrong while generating the invoice number. Please try again.',
        code: 'INVOICE_NUMBER_CONFLICT',
      });
    }
    const message = error.message || 'Failed to create sale';
    if (message.includes('Not enough stock') || message.includes('Insufficient stock') || message.includes('not found')) {
      return res.status(400).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { party_id, invoice_date, gst_percent, items } = req.body;

    if (!party_id || !invoice_date || !items || items.length === 0) {
      return res.status(400).json({ error: 'Party, date and items are required' });
    }

    const gstRate = gst_percent ?? 18;

    const updatedId = await updateSaleWithPayment(req.db, id, req.body, gstRate);

    const sale = await fetchSaleWithItems(req.db, updatedId);
    res.json(sale);
  } catch (error) {
    const message = error.message || 'Failed to update sale';
    if (
      message.includes('Not enough stock') ||
      message.includes('Insufficient stock') ||
      message.includes('not found') ||
      message.includes('Sale not found')
    ) {
      return res.status(400).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const saleId = Number(req.params.id);
    if (!Number.isFinite(saleId)) {
      return res.status(400).json({ error: 'Invalid invoice id' });
    }

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason || reason.length < 3) {
      return res.status(400).json({ error: 'Delete reason is required' });
    }

    const deletedBy = req.authUser?.id;
    if (!deletedBy) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data: saleMeta } = await req.db
      .from('sales')
      .select('id, invoice_number, total_amount, parties(name)')
      .eq('id', saleId)
      .maybeSingle();

    console.log('[sales.delete] calling soft_delete_sale', { saleId, deletedBy, reason });
    const { data, error } = await req.db.rpc('soft_delete_sale', {
      p_sale_id: saleId,
      p_deleted_by: deletedBy,
      p_delete_reason: reason,
    });

    if (error && /could not find the function|does not exist/i.test(error.message)) {
      return res.status(503).json({
        error:
          'soft_delete_sale RPC missing. Re-run supabase.migration.sales_soft_delete.sql in Supabase SQL Editor.',
      });
    }

    assertNoError(error);

    const { data: stillThere, error: verifyError } = await req.db
      .from('sales')
      .select('id, is_deleted, deleted_at, deleted_by, delete_reason')
      .eq('id', saleId)
      .maybeSingle();

    assertNoError(verifyError);

    if (!stillThere) {
      console.error(
        '[sales.delete] BUG: row gone after soft_delete_sale — DB function is hard-deleting. saleId=',
        saleId
      );
      return res.status(500).json({
        error:
          'soft_delete_sale removed the invoice row (hard delete). In Supabase SQL Editor run: SELECT pg_get_functiondef(\'public.soft_delete_sale(bigint,uuid,text)\'::regprocedure); and re-run supabase.migration.sales_soft_delete.sql',
      });
    }

    if (!stillThere.is_deleted) {
      return res.status(500).json({
        error: 'soft_delete_sale returned success but is_deleted is still false',
      });
    }

    const result = data || { restored: [], skipped: [], soft_deleted: true };
    await logActivity(req, {
      actionType: 'delete',
      entityType: 'sale',
      entityId: saleId,
      entityName: saleMeta?.invoice_number || `Sale #${saleId}`,
      details: {
        reason,
        party_name: saleMeta?.parties?.name,
        total_amount: saleMeta?.total_amount,
        soft_deleted: true,
      },
    });
    res.json({
      success: true,
      message: formatSaleDeleteMessage(result),
      stock: {
        restored: result.restored || [],
        skipped: result.skipped || [],
      },
      audit: {
        sale_id: result.sale_id ?? saleId,
        deleted_by: deletedBy,
        delete_reason: reason,
        soft_deleted: result.soft_deleted !== false,
        verified_row: stillThere,
      },
    });
  } catch (error) {
    const message = error.message || 'Failed to delete sale';
    if (message.includes('Delete reason is required')) {
      return res.status(400).json({ error: message });
    }
    if (message.includes('Sale not found')) {
      return res.status(404).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});

module.exports = router;