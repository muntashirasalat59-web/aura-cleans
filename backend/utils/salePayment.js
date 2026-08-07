function trimOrNull(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

function normalizeCollection(value) {
  const v = String(value || '').toLowerCase();
  if (v === 'paid' || v === 'paid_now' || v === 'paid now') return 'paid';
  if (v === 'pending' || v === 'partial') return v === 'partial' ? 'partial' : 'pending';
  return null;
}

function pickPaymentPayload(body) {
  const p = body?.payment && typeof body.payment === 'object' ? body.payment : body;
  const rawPaid = p.amount_paid ?? p.amount_received;
  const amountPaid =
    rawPaid === undefined || rawPaid === null || rawPaid === ''
      ? undefined
      : Math.max(0, Number(rawPaid) || 0);

  const collection =
    normalizeCollection(p.collection ?? p.payment_status ?? p.status) || undefined;

  const payload = {
    payment_bank_name: trimOrNull(p.bank_name ?? p.payment_bank_name),
    payment_account_number: trimOrNull(p.account_number ?? p.payment_account_number),
    payment_upi: trimOrNull(p.upi ?? p.payment_upi),
    payment_terms: trimOrNull(p.payment_terms ?? p.terms),
    payment_due_date: trimOrNull(p.due_date ?? p.payment_due_date),
  };

  if (collection) {
    payload.payment_status = collection === 'paid' ? 'paid' : 'pending';
    if (collection === 'paid') {
      payload.payment_due_date = null;
    }
  }

  if (amountPaid !== undefined) {
    payload.amount_paid = amountPaid;
  } else if (collection === 'paid') {
    // Marker so resolveAmountPaid fills invoice total.
    payload.amount_paid = undefined;
    payload._collection = 'paid';
  } else if (collection === 'pending') {
    payload.amount_paid = 0;
  }

  if (collection === 'paid') payload._collection = 'paid';
  if (collection === 'pending') payload._collection = 'pending';

  return payload;
}

/**
 * Resolve collected amount:
 * - Paid now → full total, no due date
 * - Pending → 0 (or explicit amount_paid for partial)
 * - Legacy: due date set → unpaid; else settled
 */
function resolveAmountPaid(paymentRow, totalAmount) {
  const total = Math.max(0, Number(totalAmount) || 0);
  const collection = paymentRow?._collection || paymentRow?.payment_status;

  if (collection === 'paid') return total;
  if (collection === 'pending') {
    if (paymentRow.amount_paid !== undefined && paymentRow.amount_paid !== null) {
      return Math.min(total, Math.max(0, Number(paymentRow.amount_paid) || 0));
    }
    return 0;
  }

  if (paymentRow && paymentRow.amount_paid !== undefined && paymentRow.amount_paid !== null) {
    return Math.min(total, Math.max(0, Number(paymentRow.amount_paid) || 0));
  }
  if (paymentRow?.payment_due_date) return 0;
  return total;
}

function resolvePaymentStatus(amountPaid, totalAmount) {
  const total = Math.max(0, Number(totalAmount) || 0);
  const paid = Math.max(0, Number(amountPaid) || 0);
  if (total <= 0 || paid >= total) return 'paid';
  if (paid > 0) return 'partial';
  return 'pending';
}

function hasPaymentData(source) {
  if (!source) return false;
  return Boolean(
    source.payment_bank_name ||
      source.payment_account_number ||
      source.payment_upi ||
      source.payment_terms ||
      source.payment_due_date ||
      source.amount_paid != null ||
      source.payment_status ||
      source.bank_name ||
      source.account_number ||
      source.upi ||
      source.terms ||
      source.due_date ||
      source.collection
  );
}

function paymentFromSale(sale) {
  if (!sale) return null;
  const status = sale.payment_status || paymentStatus(sale);
  return {
    bank_name: sale.payment_bank_name || '',
    account_number: sale.payment_account_number || '',
    upi: sale.payment_upi || '',
    payment_terms: sale.payment_terms || '',
    due_date: sale.payment_due_date || '',
    amount_paid: sale.amount_paid ?? '',
    collection: status === 'paid' ? 'paid' : 'pending',
    payment_status: status,
  };
}

/**
 * Normalize payment fields for API responses.
 * Live DBs may only have payment_due_date (no amount_paid / payment_status yet).
 */
function enrichPaymentFields(sale) {
  const total = Math.max(0, Number(sale?.total_amount) || 0);
  const hasStatus =
    sale?.payment_status != null &&
    String(sale.payment_status).trim() !== '' &&
    ['paid', 'pending', 'partial'].includes(String(sale.payment_status));
  const hasAmountPaidKey = sale != null && Object.prototype.hasOwnProperty.call(sale, 'amount_paid');

  if (hasStatus || hasAmountPaidKey) {
    let paid = Number(sale.amount_paid) || 0;
    let status = hasStatus ? String(sale.payment_status) : resolvePaymentStatus(paid, total);
    if (status === 'paid') paid = total;
    const balance_due = Math.max(0, Math.round((total - paid) * 100) / 100);
    if (balance_due <= 0) status = 'paid';
    else if (status === 'paid') status = paid > 0 ? 'partial' : 'pending';
    return { amount_paid: paid, balance_due, payment_status: status };
  }

  // Legacy: unpaid credit invoice = has a due date
  if (sale?.payment_due_date) {
    return { amount_paid: 0, balance_due: total, payment_status: 'pending' };
  }
  return { amount_paid: total, balance_due: 0, payment_status: 'paid' };
}

function balanceDue(sale) {
  return enrichPaymentFields(sale).balance_due;
}

function paymentStatus(sale) {
  return enrichPaymentFields(sale).payment_status;
}

module.exports = {
  pickPaymentPayload,
  resolveAmountPaid,
  resolvePaymentStatus,
  hasPaymentData,
  paymentFromSale,
  enrichPaymentFields,
  balanceDue,
  paymentStatus,
  trimOrNull,
};
