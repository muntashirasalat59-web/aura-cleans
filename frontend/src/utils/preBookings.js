import { DUE_SOON_DAYS } from '../config/payments';

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
