function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function dateOnly(value) {
  const raw = String(value || '').slice(0, 10);
  return raw || null;
}

function isMissingOffersError(error) {
  if (!error) return false;
  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes("could not find the table") ||
    msg.includes("could not find the 'offers'") ||
    msg.includes("could not find the 'offer_items'") ||
    (msg.includes('does not exist') && msg.includes('offer'))
  );
}

function publicErrorMessage(error) {
  const msg = String(error?.message || error || '').trim();
  const lower = msg.toLowerCase();
  if (isMissingOffersError(error) || lower.includes('schema cache')) {
    return 'Offers is not set up yet. Run backend/database/supabase.migration.offers.sql in the Supabase SQL editor.';
  }
  if (lower.includes('products') && (lower.includes('foreign key') || lower.includes('violates'))) {
    return 'One of the products was not found.';
  }
  if (lower.includes('offer_items') && lower.includes('foreign key')) {
    return 'This offer is linked to products that cannot be removed.';
  }
  const raised = msg.match(
    /Offer name is required|Combo price|Add at least one product|Each row needs a product|quantity greater than 0|Each product needs a retail rate|Valid from|not found|Only inactive/i
  );
  if (raised) return raised[0];
  return msg.replace(/^.*error:\s*/i, '') || 'Could not save this offer.';
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

function mapOfferItem(row) {
  return {
    id: row.id,
    product_id: row.product_id,
    product_name: productDisplayName(row.products) || row.product_name || '—',
    quantity: Number(row.quantity) || 0,
    rate: money(row.rate),
  };
}

function mapBookingEmbed(row) {
  return {
    id: row.id,
    party_id: row.party_id || null,
    party_name: row.parties?.name || row.party_name || '—',
    delivery_date: dateOnly(row.delivery_date),
    status: row.status || 'upcoming',
    total_amount: money(row.total_amount),
    converted_invoice_id: row.converted_invoice_id || null,
  };
}

function mapOfferRow(row) {
  if (!row) return null;
  const items = Array.isArray(row.offer_items) ? row.offer_items.map(mapOfferItem) : [];
  const bookings = Array.isArray(row.pre_bookings) ? row.pre_bookings.map(mapBookingEmbed) : [];
  return {
    id: row.id,
    business_id: row.business_id,
    offer_name: row.offer_name || '',
    combo_price: money(row.combo_price),
    valid_from: dateOnly(row.valid_from),
    valid_to: dateOnly(row.valid_to),
    is_active: row.is_active !== false,
    created_at: row.created_at,
    items,
    item_count: items.length,
    bookings,
    bookings_count:
      row.bookings_count != null ? Number(row.bookings_count) : bookings.length,
  };
}

const OFFER_SELECT =
  'id, business_id, offer_name, combo_price, valid_from, valid_to, is_active, created_at, offer_items(id, product_id, quantity, rate, products(name, unit_size, unit_type)), pre_bookings(id, party_id, delivery_date, status, total_amount, converted_invoice_id, parties(name))';

const OFFER_SELECT_NO_BOOKINGS =
  'id, business_id, offer_name, combo_price, valid_from, valid_to, is_active, created_at, offer_items(id, product_id, quantity, rate, products(name, unit_size, unit_type))';

function selectWithoutItemRate(select) {
  return String(select || '').replace(
    'offer_items(id, product_id, quantity, rate, products',
    'offer_items(id, product_id, quantity, products'
  );
}

module.exports = {
  money,
  dateOnly,
  isMissingOffersError,
  publicErrorMessage,
  mapOfferRow,
  OFFER_SELECT,
  OFFER_SELECT_NO_BOOKINGS,
  selectWithoutItemRate,
};
