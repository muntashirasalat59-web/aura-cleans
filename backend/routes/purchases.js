const express = require('express');
const router = express.Router();
const { assertNoError } = require('../database/supabase');
const { resolvePurchaseLineItems } = require('../utils/purchaseItems');
const { formatPurchaseDeleteMessage } = require('../utils/stockMessages');
const {
  enrichPaymentFields,
  pickPaymentPayload,
  resolveAmountPaid,
  resolvePaymentStatus,
} = require('../utils/salePayment');
const { logActivity } = require('../utils/activityLog');

function mapPurchaseRow(row) {
  const party = row.parties;
  const { parties, ...rest } = row;
  const mapped = {
    ...rest,
    party_name: party?.name,
    party_type: party?.type,
  };
  Object.assign(mapped, enrichPaymentFields(mapped));
  return mapped;
}

async function fetchPurchaseWithItems(db, purchaseId) {
  const { data: purchase, error: purchaseError } = await db
    .from('purchases')
    .select('*, parties(name)')
    .eq('id', purchaseId)
    .single();

  assertNoError(purchaseError);

  const { data: items, error: itemsError } = await db
    .from('purchase_items')
    .select('*, products(name)')
    .eq('purchase_id', purchaseId);

  assertNoError(itemsError);

  const mapped = mapPurchaseRow(purchase);
  mapped.items = (items || []).map((row) => ({
    ...row,
    product_name: row.products?.name,
    products: undefined,
  }));

  return mapped;
}

async function savePurchasePayment(db, purchaseId, body, totalAmount) {
  const paymentRow = pickPaymentPayload(body);
  const amount_paid = resolveAmountPaid(paymentRow, totalAmount);
  const payment_status = resolvePaymentStatus(amount_paid, totalAmount);
  const payment_due_date =
    payment_status === 'paid' ? null : paymentRow.payment_due_date || null;

  const attempts = [
    { amount_paid, payment_status, payment_due_date },
    { amount_paid, payment_due_date },
    { payment_due_date },
  ];

  let lastError = null;
  for (const patch of attempts) {
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined)
    );
    if (!Object.keys(clean).length) continue;
    const { error } = await db.from('purchases').update(clean).eq('id', purchaseId);
    if (!error) return;
    lastError = error;
    if (!/column|schema cache|could not find|does not exist/i.test(error.message || '')) {
      break;
    }
  }
  if (lastError) {
    console.warn('[purchases] payment columns missing — run supabase.migration.purchases_payment.sql');
  }
}

router.get('/', async (req, res) => {
  try {
    const { party_id } = req.query;
    let query = req.db
      .from('purchases')
      .select('*, parties(name, type)')
      .order('purchase_date', { ascending: false });

    if (party_id) {
      query = query.eq('party_id', party_id);
    }

    const { data, error } = await query;
    assertNoError(error);
    res.json((data || []).map(mapPurchaseRow));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/mark-paid', async (req, res) => {
  try {
    const purchaseId = Number(req.params.id);
    if (!purchaseId) return res.status(400).json({ error: 'Invalid purchase id' });

    const method = String(req.body?.payment_method || 'Cash').trim();
    if (!['Cash', 'Bank', 'UPI'].includes(method)) {
      return res.status(400).json({ error: 'payment_method must be Cash, Bank, or UPI' });
    }

    const paymentDate =
      String(req.body?.payment_date || '').trim() || new Date().toISOString().slice(0, 10);

    const db = req.db;
    const { data: purchase, error: purchaseError } = await db
      .from('purchases')
      .select('*')
      .eq('id', purchaseId)
      .single();
    assertNoError(purchaseError);

    const total = Number(purchase.total_amount) || 0;
    const noteLine = `Paid on ${paymentDate} via ${method}`;
    const prevNotes = (purchase.notes || '').trim();
    const notes = prevNotes.includes('Paid on ')
      ? prevNotes
      : prevNotes
        ? `${prevNotes}\n${noteLine}`
        : noteLine;

    const attempts = [
      { payment_status: 'paid', amount_paid: total, payment_due_date: null, notes },
      { amount_paid: total, payment_due_date: null, notes },
      { payment_due_date: null, notes },
      { payment_due_date: null },
    ];

    let lastError = null;
    let applied = null;
    for (const patch of attempts) {
      const { error } = await db.from('purchases').update(patch).eq('id', purchaseId);
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
      return res.status(500).json({ error: 'Failed to mark purchase as paid' });
    }

    const updated = await fetchPurchaseWithItems(db, purchaseId);
    await logActivity(req, {
      actionType: 'mark_paid',
      entityType: 'purchase',
      entityId: purchaseId,
      entityName: updated?.party_name
        ? `${updated.party_name} · ${updated.purchase_date}`
        : `Purchase #${purchaseId}`,
      details: {
        payment_method: method,
        payment_date: paymentDate,
        amount: total,
      },
    });
    res.json({
      ...updated,
      message: `Purchase marked as paid`,
      payment_method: method,
      payment_date: paymentDate,
    });
  } catch (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Purchase not found' });
    }
    res.status(500).json({ error: error.message || 'Failed to mark purchase as paid' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const purchase = await fetchPurchaseWithItems(req.db, req.params.id);
    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }
    res.json(purchase);
  } catch (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Purchase not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { party_id, purchase_date, notes, items } = req.body;

    if (!party_id || !purchase_date || !items || items.length === 0) {
      return res.status(400).json({ error: 'Party, date and items are required' });
    }

    const db = req.db;
    const { data: party, error: partyError } = await db
      .from('parties')
      .select('name')
      .eq('id', party_id)
      .maybeSingle();

    assertNoError(partyError);
    if (!party) {
      return res.status(400).json({ error: 'Party not found' });
    }

    const resolvedItems = await resolvePurchaseLineItems(db, items, {
      supplierName: party.name,
    });

    const { data: purchaseId, error } = await db.rpc('create_purchase', {
      p_party_id: party_id,
      p_purchase_date: purchase_date,
      p_notes: notes || '',
      p_gst_percent: req.body.gst_percent ?? 18,
      p_items: resolvedItems,
    });

    assertNoError(error);

    const purchase = await fetchPurchaseWithItems(db, purchaseId);
    await savePurchasePayment(db, purchaseId, req.body, purchase.total_amount);

    const withPayment = await fetchPurchaseWithItems(db, purchaseId);
    await logActivity(req, {
      actionType: 'create',
      entityType: 'purchase',
      entityId: purchaseId,
      entityName: withPayment?.party_name
        ? `${withPayment.party_name} · ${withPayment.purchase_date}`
        : `Purchase #${purchaseId}`,
      details: {
        total_amount: withPayment?.total_amount,
        payment_status: withPayment?.payment_status,
      },
    });
    res.status(201).json(withPayment);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to save purchase' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const purchaseId = Number(req.params.id);
    if (!Number.isFinite(purchaseId)) {
      return res.status(400).json({ error: 'Invalid purchase id' });
    }

    const db = req.db;
    const { data: existing } = await db
      .from('purchases')
      .select('id, purchase_date, total_amount, parties(name)')
      .eq('id', purchaseId)
      .maybeSingle();

    const { data, error } = await db.rpc('delete_purchase', { p_purchase_id: purchaseId });

    if (error && /could not find the function|does not exist/i.test(error.message)) {
      return res.status(503).json({
        error:
          'Stock reversal on delete is not configured. Run supabase.migration.stock_restore_on_delete.sql in Supabase.',
      });
    }

    assertNoError(error);

    const result = data || { reversed: [], skipped: [] };
    const partyName = existing?.parties?.name;
    await logActivity(req, {
      actionType: 'delete',
      entityType: 'purchase',
      entityId: purchaseId,
      entityName: partyName
        ? `${partyName} · ${existing.purchase_date}`
        : `Purchase #${purchaseId}`,
      details: { total_amount: existing?.total_amount },
    });
    res.json({
      success: true,
      message: formatPurchaseDeleteMessage(result),
      stock: result,
    });
  } catch (error) {
    const message = error.message || 'Failed to delete purchase';
    if (message.includes('Purchase not found')) {
      return res.status(404).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});

module.exports = router;