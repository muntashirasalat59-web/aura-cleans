import { emptyProductLine } from '../components/forms/ProductLineItemsEditor';
import { DEFAULT_GST_RATE, money, productGstPercent } from './preBookings';
import { listedRetailPrice } from './productPricing';

export function emptyComboLine() {
  return { product_id: '', quantity: '1', rate: '' };
}

export function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isOfferActiveNow(offer, today = todayISODate()) {
  if (!offer || offer.is_active === false) return false;
  const from = String(offer.valid_from || '').slice(0, 10);
  const to = String(offer.valid_to || '').slice(0, 10);
  if (from && from > today) return false;
  if (to && to < today) return false;
  return true;
}

/** Combo line unit rate: edited value if present, otherwise catalog retail. */
export function comboLineRate(item, product) {
  if (item?.rate !== '' && item?.rate != null && Number.isFinite(Number(item.rate))) {
    return Number(item.rate);
  }
  return listedRetailPrice(product);
}

export function comboLineAmount(item, product) {
  const qty = Number(item?.quantity) || 0;
  return money(comboLineRate(item, product) * qty);
}

export function comboRetailTotal(items, products) {
  return money(
    (items || []).reduce((sum, item) => {
      if (!item?.product_id) return sum;
      const product = products.find((p) => String(p.id) === String(item.product_id));
      return sum + comboLineAmount(item, product);
    }, 0)
  );
}

/**
 * Fill pre-booking lines from a combo offer. Rates are split so line totals
 * (incl. GST) add up to combo_price. Weights follow each item's combo retail rate.
 */
export function comboToPreBookingItems(offer, products) {
  const items = (offer?.items || []).filter(
    (item) => item?.product_id && Number(item.quantity) > 0
  );
  if (!items.length) return [emptyProductLine()];

  const comboPrice = money(offer?.combo_price);
  const rows = items.map((item) => {
    const product = products.find((p) => String(p.id) === String(item.product_id));
    const quantity = Number(item.quantity) || 1;
    const gst_percent = product ? productGstPercent(product) : DEFAULT_GST_RATE;
    const unitRate = comboLineRate(item, product);
    return {
      product_id: String(item.product_id),
      quantity,
      unitRate,
      retailLine: unitRate * quantity,
      gst_percent,
    };
  });

  const totalRetail = rows.reduce((sum, row) => sum + row.retailLine, 0);

  if (!(comboPrice > 0)) {
    return rows.map((row) => ({
      product_id: row.product_id,
      quantity: String(row.quantity),
      rate: String(row.unitRate),
      gst_percent: String(row.gst_percent),
    }));
  }

  let allocated = 0;
  return rows.map((row, index) => {
    const weight = totalRetail > 0 ? row.retailLine / totalRetail : 1 / rows.length;
    const isLast = index === rows.length - 1;
    const lineIncl = isLast ? money(comboPrice - allocated) : money(comboPrice * weight);
    if (!isLast) allocated = money(allocated + lineIncl);
    const gst = Number(row.gst_percent) || 0;
    const taxable = gst > 0 ? money(lineIncl / (1 + gst / 100)) : lineIncl;
    const rate = row.quantity > 0 ? money(taxable / row.quantity) : 0;
    return {
      product_id: row.product_id,
      quantity: String(row.quantity),
      rate: String(rate),
      gst_percent: String(row.gst_percent),
    };
  });
}
