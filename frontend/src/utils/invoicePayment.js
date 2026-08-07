function deriveCollectionFromSale(sale) {
  const status = sale?.payment_status;
  if (status === 'paid') return 'paid';
  if (status === 'pending' || status === 'partial') return 'pending';
  const total = Number(sale?.total_amount) || 0;
  const paid = Number(sale?.amount_paid) || 0;
  if (total <= 0 || paid >= total) return 'paid';
  return 'pending';
}

export function emptyPaymentDetails() {
  return {
    collection: 'paid',
    bank_name: '',
    account_number: '',
    upi: '',
    payment_terms: '',
    due_date: '',
    amount_paid: '',
  };
}

/** Default due date = today + N days (YYYY-MM-DD). */
export function defaultDueDate(daysAhead = 3, fromDate = new Date()) {
  const d = new Date(fromDate);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + daysAhead);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function hasPaymentDetails(payment) {
  if (!payment) return false;
  return Boolean(
    payment.bank_name?.trim() ||
      payment.account_number?.trim() ||
      payment.upi?.trim() ||
      payment.payment_terms?.trim() ||
      payment.due_date?.trim() ||
      payment.collection === 'pending' ||
      (payment.amount_paid !== '' && payment.amount_paid != null)
  );
}

export function paymentFromSale(sale) {
  if (!sale) return emptyPaymentDetails();
  return {
    collection: deriveCollectionFromSale(sale),
    bank_name: sale.payment_bank_name || '',
    account_number: sale.payment_account_number || '',
    upi: sale.payment_upi || '',
    payment_terms: sale.payment_terms || '',
    due_date: sale.payment_due_date || '',
    amount_paid: sale.amount_paid === 0 || sale.amount_paid ? String(sale.amount_paid) : '',
  };
}

export function paymentToPayload(payment) {
  const p = payment || emptyPaymentDetails();
  const collection = p.collection === 'pending' ? 'pending' : 'paid';
  const payload = {
    collection,
    payment_status: collection,
    bank_name: p.bank_name?.trim() || null,
    account_number: p.account_number?.trim() || null,
    upi: p.upi?.trim() || null,
    payment_terms: p.payment_terms?.trim() || null,
    due_date: collection === 'pending' ? p.due_date?.trim() || null : null,
  };
  if (collection === 'paid') {
    // Backend sets amount_paid = invoice total.
    payload.amount_paid = undefined;
  } else {
    payload.amount_paid = 0;
  }
  return payload;
}

export function formatDisplayDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
