import { DUE_SOON_DAYS } from '../config/payments';

export const DEFAULT_GST_RATE = 18;

export function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function productGstPercent(product) {
  const raw = product?.gst_percent ?? product?.gst_rate ?? product?.default_gst;
  if (raw === 0 || raw === '0') return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_GST_RATE;
}

export function computePreBookingLine(item) {
  const quantity = Number(item?.quantity) || 0;
  const rate = Number(item?.rate) || 0;
  const rawGst = item?.gst_percent;
  const gst_percent =
    rawGst === undefined || rawGst === null || rawGst === ''
      ? DEFAULT_GST_RATE
      : Number(rawGst) || 0;
  const taxable = money(quantity * rate);
  const gst_amount = money((taxable * gst_percent) / 100);
  const amount = money(taxable + gst_amount);
  return { quantity, rate, gst_percent, taxable, gst_amount, amount };
}

export function computePreBookingTotals(items) {
  return (items || []).reduce(
    (acc, item) => {
      const line = computePreBookingLine(item);
      acc.subtotal = money(acc.subtotal + line.taxable);
      acc.gstAmount = money(acc.gstAmount + line.gst_amount);
      acc.total = money(acc.total + line.amount);
      return acc;
    },
    { subtotal: 0, gstAmount: 0, total: 0 }
  );
}

export function displayGstPercent(items, totals) {
  const percents = (items || [])
    .filter((item) => item?.product_id)
    .map((item) => Number(item.gst_percent) || 0);
  const unique = [...new Set(percents)];
  if (unique.length === 1) return unique[0];
  if (!totals?.subtotal) return 0;
  return money((totals.gstAmount / totals.subtotal) * 100);
}

export function dateOnly(value) {
  return String(value || '').slice(0, 10);
}

export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** overdue | due_soon | upcoming | delivered | cancelled */
export function bookingDisplayStatus(row, today = todayISO()) {
  const status = row?.status || 'upcoming';
  if (status !== 'upcoming') return status;
  const day = dateOnly(row.delivery_date);
  if (!day) return 'upcoming';
  if (day < today) return 'overdue';
  const due = new Date(`${day}T12:00:00`);
  const start = new Date(`${today}T12:00:00`);
  const diffDays = Math.round((due.getTime() - start.getTime()) / 86400000);
  if (diffDays <= DUE_SOON_DAYS) return 'due_soon';
  return 'upcoming';
}

export function bookingStatusLabel(status) {
  if (status === 'overdue') return 'Overdue';
  if (status === 'due_soon') return 'Due soon';
  if (status === 'delivered') return 'Delivered';
  if (status === 'cancelled') return 'Cancelled';
  return 'Upcoming';
}

export function bookingStatusBadgeClass(status) {
  if (status === 'overdue') return 'badge badge-danger';
  if (status === 'due_soon') return 'badge badge-orange';
  if (status === 'delivered') return 'badge badge-green';
  if (status === 'cancelled') return 'badge';
  return 'badge badge-blue';
}
