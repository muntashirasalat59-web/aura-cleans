const DUE_SOON_DAYS = 3;

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
  return {
    id: row.id,
    product_id: row.product_id,
    product_name: productDisplayName(row.products) || row.product_name || '—',
    quantity,
    rate,
    amount: Number(row.amount) || money(rate * quantity),
  };
}

function itemsFromRow(row) {
  if (Array.isArray(row.pre_booking_items) && row.pre_booking_items.length > 0) {
    return row.pre_booking_items.map(mapItem);
  }
  if (row.product_id) {
    return [
      mapItem({
        product_id: row.product_id,
        quantity: row.quantity,
        rate: row.rate,
        amount: row.total_amount,
        products: row.products,
      }),
    ];
  }
  return [];
}

function mapPreBookingRow(row) {
  const status = row.status || 'upcoming';
  const items = itemsFromRow(row);
  const item_count = items.length;
  const firstName = items[0]?.product_name || '—';
  const product_name =
    item_count <= 1 ? firstName : `${firstName} +${item_count - 1}`;
  const total_amount =
    Number(row.total_amount) || items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  return {
    ...row,
    party_name: row.parties?.name || row.party_name || '—',
    items,
    item_count,
    product_name,
    quantity: items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    total_amount: money(total_amount),
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
  isMissingTableError,
  dateOnly,
  localTodayISO,
  money,
  deliveryUrgency,
  mapPreBookingRow,
  dueSoonRows,
};
