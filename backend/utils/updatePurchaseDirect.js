/**
 * Node-side purchase update: reverse old stock/balance, apply new lines.
 * Mirrors create_purchase / delete_purchase semantics.
 */

const { assertNoError } = require('../database/supabase');
const { resolvePurchaseLineItems } = require('./purchaseItems');
const {
  pickPaymentPayload,
  resolveAmountPaid,
  resolvePaymentStatus,
} = require('./salePayment');

function omitUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

async function applyPurchasePaymentUpdate(db, purchaseId, body, totalAmount) {
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

  const full = omitUndefined({
    ...rest,
    amount_paid,
    payment_status,
    payment_due_date,
  });

  const attempts = [
    full,
    (({ payment_status: _ps, ...r }) => r)(full),
    (({ payment_status: _ps, amount_paid: _ap, ...r }) => r)(full),
    omitUndefined({ payment_due_date }),
  ];

  let lastError = null;
  for (const patch of attempts) {
    if (!Object.keys(patch).length) continue;
    const { error } = await db.from('purchases').update(patch).eq('id', purchaseId);
    if (!error) return;
    lastError = error;
    if (!/column|schema cache|could not find|does not exist/i.test(error.message || '')) {
      break;
    }
  }
  if (lastError) {
    console.warn('[purchases] payment columns missing on update:', lastError.message);
  }
}

/**
 * @returns {Promise<number>} purchase id
 */
async function updatePurchaseDirect(db, purchaseId, body) {
  const id = Number(purchaseId);
  const partyId = Number(body.party_id);
  const items = body.items || [];

  if (!id || !partyId || !items.length) {
    throw new Error('Party, date and items are required');
  }

  const { data: oldPurchase, error: oldErr } = await db
    .from('purchases')
    .select('id, party_id, total_amount')
    .eq('id', id)
    .single();
  assertNoError(oldErr);

  const { data: oldItems, error: oldItemsErr } = await db
    .from('purchase_items')
    .select('product_id, quantity')
    .eq('purchase_id', id);
  assertNoError(oldItemsErr);

  // Reverse previous stock (purchase had added stock)
  for (const row of oldItems || []) {
    const { data: product, error } = await db
      .from('products')
      .select('id, stock_quantity')
      .eq('id', row.product_id)
      .maybeSingle();
    if (error) assertNoError(error);
    if (!product) continue;
    const { error: stockErr } = await db
      .from('products')
      .update({
        stock_quantity: Number(product.stock_quantity) - Number(row.quantity),
      })
      .eq('id', row.product_id);
    assertNoError(stockErr);
  }

  // Reverse previous payable on old party (create_purchase did balance -= total)
  const { data: oldParty, error: oldPartyErr } = await db
    .from('parties')
    .select('balance')
    .eq('id', oldPurchase.party_id)
    .single();
  assertNoError(oldPartyErr);
  await db
    .from('parties')
    .update({
      balance: Number(oldParty.balance || 0) + Number(oldPurchase.total_amount || 0),
    })
    .eq('id', oldPurchase.party_id);

  await db.from('purchase_items').delete().eq('purchase_id', id);

  const { data: party, error: partyError } = await db
    .from('parties')
    .select('name')
    .eq('id', partyId)
    .maybeSingle();
  assertNoError(partyError);
  if (!party) {
    throw new Error('Party not found');
  }

  const resolvedItems = await resolvePurchaseLineItems(db, items, {
    supplierName: party.name,
  });

  let subtotal = 0;
  const normalized = [];
  for (const item of resolvedItems) {
    const productId = Number(item.product_id);
    const qty = parseInt(item.quantity, 10);
    const rate = Number(item.rate);
    const amount = qty * rate;
    subtotal += amount;
    normalized.push({ product_id: productId, quantity: qty, rate, amount });
  }

  const gstPercent = Number(body.gst_percent) || 18;
  const gstAmount = (subtotal * gstPercent) / 100;
  const total = subtotal + gstAmount;

  const { error: updErr } = await db
    .from('purchases')
    .update({
      party_id: partyId,
      purchase_date: body.purchase_date,
      notes: body.notes || '',
      subtotal,
      gst_percent: gstPercent,
      gst_amount: gstAmount,
      total_amount: total,
    })
    .eq('id', id);
  assertNoError(updErr);

  const { error: itemsError } = await db.from('purchase_items').insert(
    normalized.map((row) => ({
      purchase_id: id,
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
      .update({
        stock_quantity: Number(product.stock_quantity) + row.quantity,
        cost_price: row.rate,
      })
      .eq('id', row.product_id);
    assertNoError(stockErr);
  }

  const { data: newParty, error: newPartyErr } = await db
    .from('parties')
    .select('balance')
    .eq('id', partyId)
    .single();
  assertNoError(newPartyErr);
  await db
    .from('parties')
    .update({ balance: Number(newParty.balance || 0) - total })
    .eq('id', partyId);

  await applyPurchasePaymentUpdate(db, id, body, total);
  return id;
}

module.exports = { updatePurchaseDirect };
