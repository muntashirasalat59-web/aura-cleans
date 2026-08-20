const DUE_SOON_DAYS = 3;

const LIST_SELECT =
  'id, business_id, party_id, delivery_date, notes, status, subtotal, gst_total, total_amount, created_at, parties(name), pre_booking_items(id, product_id, quantity, rate, gst_percent, gst_amount, amount, products(name, unit_size, unit_type))';

function isMissingTableError(error) {
  if (!error) return false;
  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes("could not find the 'pre_bookings'") ||
    msg.includes("could not find the 'pre_booking_items'")
  );
}

function dateOnly(value) {
  return String(value || '').slice(0, 10);
}

function localTodayISO(today = new Date()) {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function publicErrorMessage(error) {
  const msg = String(error?.message || error || '').trim();
  const lower = msg.toLowerCase();
  if (
    lower.includes('could not find the function') ||
    (lower.includes('create_pre_booking') && lower.includes('does not exist'))
  ) {
    return 'Pre-bookings is not set up yet. Run backend/database/supabase.rebuild.pre_bookings.sql in the Supabase SQL editor.';
  }
  if (isMissingTableError(error) || lower.includes('schema cache')) {
    return 'Pre-bookings is not set up yet. Run backend/database/supabase.rebuild.pre_bookings.sql in the Supabase SQL editor.';
  }
  if (lower.includes('null value in column "product_id"')) {
    return 'Pre-bookings still has the old single-product column. Run the rebuild SQL in Supabase, then try again.';
  }
  if (lower.includes('parties') && (lower.includes('foreign key') || lower.includes('violates'))) {
    return 'That party was not found.';
  }
  if (lower.includes('products') && (lower.includes('foreign key') || lower.includes('violates'))) {
    return 'One of the products was not found.';
  }
  const raised = msg.match(/Add at least one product|Party is required|Delivery date is required|Business is required|Each product needs|Each row needs|GST percent cannot be negative/i);
  if (raised) return raised[0];
  return msg.replace(/^.*error:\s*/i, '') || 'Could not save this pre-booking.';
}

/** overdue | due_soon | upcoming — only meaningful while status is upcoming. */
function deliveryUrgency(deliveryDate, todayIso = localTodayISO()) {
  const day = dateOnly(deliveryDate);
  if (!day) return 'upcoming';
  if (day < todayIso) return 'overdue';
  const due = new Date(`${day}T12:00:00`);
  const start = new Date(`${todayIso}T12:00:00`);
  const diffDays = Math.round((due.getTime() - start.getTime()) / 86400000);
  if (diffDays <= DUE_SOON_DAYS) return 'due_soon';
  return 'upcoming';
}

function productDisplayName(product) {
  if (!product) return '';
  const name = (product.name || '').trim();
  const size = product.unit_size;
  const type = product.unit_type;
  const pack =
    type && (size == null || size === '')
      ? type
      : type
        ? `${Number(size)} ${type}`
        : '';
  if (name && pack) return `${name} (${pack})`;
  return name || '—';
}

function mapItem(row) {
  const quantity = Number(row.quantity) || 0;
  const rate = Number(row.rate) || 0;
  const gst_percent = Number(row.gst_percent) || 0;
  const taxable = money(rate * quantity);
  const gst_amount = Number(row.gst_amount) || money((taxable * gst_percent) / 100);
  const amount = Number(row.amount) || money(taxable + gst_amount);
  return {
    id: row.id,
    product_id: row.product_id,
    product_name: productDisplayName(row.products) || row.product_name || '—',
    quantity,
    rate,
    gst_percent,
    gst_amount,
    taxable,
    amount,
  };
}

function mapPreBookingRow(row) {
  if (!row) return null;
  const status = row.status || 'upcoming';
  const items = Array.isArray(row.pre_booking_items) ? row.pre_booking_items.map(mapItem) : [];
  const item_count = items.length;
  const firstName = items[0]?.product_name || '—';
  const product_name = item_count <= 1 ? firstName : `${firstName} +${item_count - 1}`;
  const subtotal = Number(row.subtotal) || items.reduce((sum, item) => sum + item.taxable, 0);
  const gst_total = Number(row.gst_total) || items.reduce((sum, item) => sum + item.gst_amount, 0);
  const total_amount = Number(row.total_amount) || money(subtotal + gst_total);

  return {
    id: row.id,
    business_id: row.business_id,
    party_id: row.party_id,
    party_name: row.parties?.name || row.party_name || '—',
    delivery_date: dateOnly(row.delivery_date),
    notes: row.notes || '',
    status,
    items,
    item_count,
    product_name,
    subtotal: money(subtotal),
    gst_total: money(gst_total),
    total_amount: money(total_amount),
    created_at: row.created_at,
    urgency: status === 'upcoming' ? deliveryUrgency(row.delivery_date) : status,
  };
}

function dueSoonRows(rows) {
  return (rows || [])
    .filter((row) => row.status === 'upcoming' && (row.urgency === 'overdue' || row.urgency === 'due_soon'))
    .sort((a, b) => {
      const rank = { overdue: 0, due_soon: 1, upcoming: 2 };
      const diff = (rank[a.urgency] ?? 9) - (rank[b.urgency] ?? 9);
      if (diff !== 0) return diff;
      return dateOnly(a.delivery_date).localeCompare(dateOnly(b.delivery_date));
    });
}

module.exports = {
  DUE_SOON_DAYS,
  LIST_SELECT,
  isMissingTableError,
  dateOnly,
  localTodayISO,
  money,
  publicErrorMessage,
  deliveryUrgency,
  mapPreBookingRow,
  dueSoonRows,
};
