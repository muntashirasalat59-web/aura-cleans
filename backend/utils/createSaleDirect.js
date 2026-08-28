/**
 * Node-side sale create/update when Supabase RPCs are broken/missing
 * (e.g. create_sale calls apply_sale_payment_from_json that is not deployed).
 *
 * Mirrors create_sale / update_sale stock + party balance behaviour.
 */

const { assertNoError } = require('../database/supabase');
const {
  pickPaymentPayload,
  resolveAmountPaid,
  resolvePaymentStatus,
} = require('./salePayment');
const { resolveSaleGst, computeSaleGstTotals } = require('./saleGst');

function paymentFieldsForUpdate(body, totalAmount) {
  const paymentRow = pickPaymentPayload(body);
  const amount_paid = resolveAmountPaid(paymentRow, totalAmount);
  const payment_status = resolvePaymentStatus(amount_paid, totalAmount);
  const payment_due_date =
    payment_status === 'paid' ? null : paymentRow.payment_due_date || null;

  const {
    amount_paid: _a,
    payment_status: _s,
    payment_due_date: _d,
    _collection,
    ...rest
  } = paymentRow;

  return {
    ...rest,
    amount_paid,
    payment_status,
    payment_due_date,
  };
}

async function applyInvoiceAddressMeta(db, saleId, body) {
  const place = String(body?.place_of_supply || '').trim();
  const shipping = String(body?.shipping_address || '').trim();
  const sameAsBilling = body?.ship_same_as_billing !== false && !shipping;
  const shipCity = String(body?.ship_to_city || '').trim();
  const shipAddr = String(body?.ship_to_address || '').trim();

  const gstMeta = {
    place_of_supply: place || null,
    shipping_address: sameAsBilling ? null : shipping,
  };
  const courierMeta = {
    ship_to_city: shipCity || null,
    ship_to_address: shipAddr || null,
  };

  const attempts = [{ ...gstMeta, ...courierMeta }, gstMeta];
  let lastError = null;
  for (const patch of attempts) {
    const { error } = await db.from('sales').update(patch).eq('id', saleId);
    if (!error) {
      if (!('ship_to_city' in patch) && (shipCity || shipAddr)) {
        console.warn(
          '[sales] ship_to_city/ship_to_address missing — run supabase.migration.sales_ship_to.sql'
        );
      }
      return;
    }
    lastError = error;
    if (!/column|schema cache|could not find|does not exist/i.test(error.message || '')) {
      break;
    }
  }

  if (lastError && /column|schema cache|could not find|does not exist/i.test(lastError.message || '')) {
    console.warn(
      '[sales] place_of_supply/shipping_address missing — run supabase.migration.sales_place_of_supply.sql'
    );
    return;
  }
  if (lastError) assertNoError(lastError);
}

async function applySaleGstFlag(db, saleId, isGstInvoice) {
  const { error } = await db
    .from('sales')
    .update({ is_gst_invoice: Boolean(isGstInvoice) })
    .eq('id', saleId);
  if (error && /column|schema cache|could not find|does not exist/i.test(error.message || '')) {
    console.warn(
      '[sales] is_gst_invoice missing — run supabase.migration.sales_is_gst_invoice.sql'
    );
    return;
  }
  if (error) assertNoError(error);
}

function omitUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

async function applyPaymentUpdate(db, saleId, body, totalAmount) {
  const full = paymentFieldsForUpdate(body, totalAmount);

  // Progressively drop columns that may not exist until migration is applied.
  const attempts = [
    full,
    (({ payment_status, ...rest }) => rest)(full),
    (({ payment_status, amount_paid, ...rest }) => rest)(full),
    {
      payment_due_date: full.payment_due_date,
      payment_bank_name: full.payment_bank_name,
      payment_account_number: full.payment_account_number,
      payment_upi: full.payment_upi,
      payment_terms: full.payment_terms,
    },
    { payment_due_date: full.payment_due_date },
  ];

  let lastError = null;
  for (const patch of attempts) {
    const clean = omitUndefined(patch);
    if (!Object.keys(clean).length) continue;
    const { error } = await db.from('sales').update(clean).eq('id', saleId);
    if (!error) {
      if (clean !== full && !clean.payment_status) {
        console.warn(
          '[sales] payment saved with reduced columns (run supabase.migration.apply_sale_payment_fn.sql):',
          Object.keys(clean).join(', ')
        );
      }
      return;
    }
    lastError = error;
    if (!/column|schema cache|could not find|does not exist/i.test(error.message || '')) {
      break;
    }
  }
  assertNoError(lastError);
}

async function createSaleDirect(db, body, invoiceNumber, gstRate) {
  const partyId = Number(body.party_id);
  const items = body.items || [];
  if (!partyId || !items.length) {
    throw new Error('Party, date and items are required');
  }

  let subtotal = 0;
  const normalized = [];

  for (const item of items) {
    const productId = Number(item.product_id);
    const qty = parseInt(item.quantity, 10);
    const rate = Number(item.rate);
    if (!productId || !qty || qty < 1) {
      throw new Error('Invalid line item');
    }

    const { data: product, error } = await db
      .from('products')
      .select('id, name, stock_quantity')
      .eq('id', productId)
      .single();
    assertNoError(error);

    if (Number(product.stock_quantity) < qty) {
      throw new Error(
        `Not enough stock for ${product.name}. Available: ${product.stock_quantity}`
      );
    }

    const amount = qty * rate;
    subtotal += amount;
    normalized.push({ product_id: productId, quantity: qty, rate, amount });
  }

  const gst = resolveSaleGst({
    is_gst_invoice: body?.is_gst_invoice,
    gst_percent: gstRate != null && gstRate !== '' ? gstRate : body?.gst_percent,
  });
  const gstPercent = gst.gstPercent;
  const { gstAmount, total } = computeSaleGstTotals(subtotal, gstPercent);

  const { data: sale, error: saleError } = await db
    .from('sales')
    .insert({
      party_id: partyId,
      invoice_number: invoiceNumber,
      invoice_date: body.invoice_date,
      subtotal,
      gst_percent: gstPercent,
      gst_amount: gstAmount,
      total_amount: total,
    })
    .select('id, total_amount')
    .single();
  assertNoError(saleError);

  const saleId = sale.id;

  try {
    const { error: itemsError } = await db.from('sale_items').insert(
      normalized.map((row) => ({
        sale_id: saleId,
        product_id: row.product_id,
        quantity: row.quantity,
        rate: row.rate,
        amount: row.amount,
      }))
    );
    assertNoError(itemsError);

    for (const row of normalized) {
      const { data: product, error: readErr } = await db
        .from('products')
        .select('stock_quantity')
        .eq('id', row.product_id)
        .single();
      assertNoError(readErr);
      const { error: stockErr } = await db
        .from('products')
        .update({ stock_quantity: Number(product.stock_quantity) - row.quantity })
        .eq('id', row.product_id);
      assertNoError(stockErr);
    }

    const { data: party, error: partyErr } = await db
      .from('parties')
      .select('balance')
      .eq('id', partyId)
      .single();
    assertNoError(partyErr);
    const { error: balErr } = await db
      .from('parties')
      .update({ balance: Number(party.balance || 0) + total })
      .eq('id', partyId);
    assertNoError(balErr);

    await applyPaymentUpdate(db, saleId, body, total);
    await applyInvoiceAddressMeta(db, saleId, body);
    await applySaleGstFlag(db, saleId, gst.is_gst_invoice);
  } catch (err) {
    // Best-effort cleanup of the draft sale row
    await db.from('sale_items').delete().eq('sale_id', saleId);
    await db.from('sales').delete().eq('id', saleId);
    throw err;
  }

  return saleId;
}

async function updateSaleDirect(db, saleId, body, gstRate) {
  const id = Number(saleId);
  const partyId = Number(body.party_id);
  const items = body.items || [];
  if (!partyId || !items.length) {
    throw new Error('Party, date and items are required');
  }

  const { data: oldSale, error: oldErr } = await db
    .from('sales')
    .select('id, party_id, total_amount')
    .eq('id', id)
    .eq('is_deleted', false)
    .single();
  assertNoError(oldErr);

  const { data: oldItems, error: oldItemsErr } = await db
    .from('sale_items')
    .select('product_id, quantity')
    .eq('sale_id', id);
  assertNoError(oldItemsErr);

  // Restore previous stock + reverse previous party balance
  for (const row of oldItems || []) {
    const { data: product, error } = await db
      .from('products')
      .select('stock_quantity')
      .eq('id', row.product_id)
      .single();
    assertNoError(error);
    const { error: stockErr } = await db
      .from('products')
      .update({ stock_quantity: Number(product.stock_quantity) + Number(row.quantity) })
      .eq('id', row.product_id);
    assertNoError(stockErr);
  }

  const { data: oldParty, error: oldPartyErr } = await db
    .from('parties')
    .select('balance')
    .eq('id', oldSale.party_id)
    .single();
  assertNoError(oldPartyErr);
  await db
    .from('parties')
    .update({ balance: Number(oldParty.balance || 0) - Number(oldSale.total_amount || 0) })
    .eq('id', oldSale.party_id);

  await db.from('sale_items').delete().eq('sale_id', id);

  let subtotal = 0;
  const normalized = [];
  for (const item of items) {
    const productId = Number(item.product_id);
    const qty = parseInt(item.quantity, 10);
    const rate = Number(item.rate);
    const { data: product, error } = await db
      .from('products')
      .select('id, name, stock_quantity')
      .eq('id', productId)
      .single();
    assertNoError(error);
    if (Number(product.stock_quantity) < qty) {
      throw new Error(
        `Not enough stock for ${product.name}. Available: ${product.stock_quantity}`
      );
    }
    const amount = qty * rate;
    subtotal += amount;
    normalized.push({ product_id: productId, quantity: qty, rate, amount });
  }

  const gst = resolveSaleGst({
    is_gst_invoice: body?.is_gst_invoice,
    gst_percent: gstRate != null && gstRate !== '' ? gstRate : body?.gst_percent,
  });
  const gstPercent = gst.gstPercent;
  const { gstAmount, total } = computeSaleGstTotals(subtotal, gstPercent);

  const { error: updErr } = await db
    .from('sales')
    .update({
      party_id: partyId,
      invoice_date: body.invoice_date,
      subtotal,
      gst_percent: gstPercent,
      gst_amount: gstAmount,
      total_amount: total,
    })
    .eq('id', id);
  assertNoError(updErr);

  const { error: itemsError } = await db.from('sale_items').insert(
    normalized.map((row) => ({
      sale_id: id,
      product_id: row.product_id,
      quantity: row.quantity,
      rate: row.rate,
      amount: row.amount,
    }))
  );
  assertNoError(itemsError);

  for (const row of normalized) {
    const { data: product, error: readErr } = await db
      .from('products')
      .select('stock_quantity')
      .eq('id', row.product_id)
      .single();
    assertNoError(readErr);
    const { error: stockErr } = await db
      .from('products')
      .update({ stock_quantity: Number(product.stock_quantity) - row.quantity })
      .eq('id', row.product_id);
    assertNoError(stockErr);
  }

  const { data: party, error: partyErr } = await db
    .from('parties')
    .select('balance')
    .eq('id', partyId)
    .single();
  assertNoError(partyErr);
  await db
    .from('parties')
    .update({ balance: Number(party.balance || 0) + total })
    .eq('id', partyId);

  await applyPaymentUpdate(db, id, body, total);
  await applyInvoiceAddressMeta(db, id, body);
  await applySaleGstFlag(db, id, gst.is_gst_invoice);
  return id;
}

module.exports = {
  createSaleDirect,
  updateSaleDirect,
  paymentFieldsForUpdate,
  applyInvoiceAddressMeta,
  applySaleGstFlag,
};
