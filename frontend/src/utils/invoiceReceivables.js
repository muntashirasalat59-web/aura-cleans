import { DUE_SOON_DAYS } from '../config/payments';
import { formatDisplayDate } from './invoicePayment';

/** Match backend enrichPaymentFields — works with or without amount_paid column. */
export function enrichPaymentFields(sale) {
  const total = Math.max(0, Number(sale?.total_amount) || 0);
  const hasStatus =
    sale?.payment_status != null &&
    String(sale.payment_status).trim() !== '' &&
    ['paid', 'pending', 'partial'].includes(String(sale.payment_status));
  const hasAmountPaidKey = sale != null && Object.prototype.hasOwnProperty.call(sale, 'amount_paid');

  if (hasStatus || hasAmountPaidKey) {
    let paid = Number(sale.amount_paid) || 0;
    let status = hasStatus ? String(sale.payment_status) : null;
    if (!status) {
      if (total <= 0 || paid >= total) status = 'paid';
      else if (paid > 0) status = 'partial';
      else status = 'pending';
    }
    if (status === 'paid') paid = total;
    const balance_due = Math.max(0, Math.round((total - paid) * 100) / 100);
    if (balance_due <= 0) status = 'paid';
    else if (status === 'paid') status = paid > 0 ? 'partial' : 'pending';
    return { amount_paid: paid, amount_received: paid, balance_due, payment_status: status };
  }

  if (sale?.payment_due_date) {
    return { amount_paid: 0, amount_received: 0, balance_due: total, payment_status: 'pending' };
  }
  return { amount_paid: total, amount_received: total, balance_due: 0, payment_status: 'paid' };
}

export function balanceDue(sale) {
  return enrichPaymentFields(sale).balance_due;
}

export function paymentStatus(sale) {
  return enrichPaymentFields(sale).payment_status;
}

/** @returns {'overdue'|'due_soon'|'upcoming'|'none'} */
export function dueUrgency(dueDateIso, today = new Date()) {
  if (!dueDateIso) return 'none';
  const due = new Date(`${dueDateIso}T12:00:00`);
  if (Number.isNaN(due.getTime())) return 'none';

  const start = new Date(today);
  start.setHours(12, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - start.getTime()) / 86400000);

  if (diffDays < 0) return 'overdue';
  if (diffDays <= DUE_SOON_DAYS) return 'due_soon';
  return 'upcoming';
}

export function enrichReceivable(sale) {
  const payment = enrichPaymentFields(sale);
  const urgency = dueUrgency(sale.payment_due_date);
  return {
    id: sale.id,
    invoice_number: sale.invoice_number,
    party_name: sale.party_name || sale.parties?.name || '—',
    invoice_date: sale.invoice_date,
    payment_due_date: sale.payment_due_date || null,
    due_date_display: sale.payment_due_date ? formatDisplayDate(sale.payment_due_date) : '—',
    total_amount: Number(sale.total_amount) || 0,
    amount_paid: payment.amount_paid,
    balance_due: payment.balance_due,
    payment_status: payment.payment_status,
    urgency,
  };
}

export function summarizePendingInvoices(sales) {
  const pending = (sales || [])
    .map(enrichReceivable)
    .filter((s) => s.balance_due > 0 && (s.payment_status === 'pending' || s.payment_status === 'partial'))
    .sort((a, b) => {
      const rank = { overdue: 0, due_soon: 1, upcoming: 2, none: 3 };
      const diff = rank[a.urgency] - rank[b.urgency];
      if (diff !== 0) return diff;
      const da = a.payment_due_date || '9999-99-99';
      const db = b.payment_due_date || '9999-99-99';
      return da.localeCompare(db);
    });

  const totalDue = pending.reduce((acc, s) => acc + s.balance_due, 0);
  const hasOverdue = pending.some((s) => s.urgency === 'overdue');
  const hasDueSoon = pending.some((s) => s.urgency === 'due_soon');
  const tone = hasOverdue ? 'danger' : hasDueSoon ? 'warning' : 'info';

  return {
    pendingInvoices: pending,
    pendingPayments: Math.round(totalDue * 100) / 100,
    pendingInvoiceCount: pending.length,
    pendingTone: tone,
    hasOverdue,
    hasDueSoon,
  };
}
