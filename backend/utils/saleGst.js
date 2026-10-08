function parseBoolFlag(value) {
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  return null;
}

/**
 * Canonical GST mode for a sale payload.
 * is_gst_invoice=false always wins (gst forced to 0), even if the client sent 18%.
 */
function resolveSaleGst(body) {
  const flagged = parseBoolFlag(body?.is_gst_invoice);
  const rawRate = Number(body?.gst_percent);
  const rate = Number.isFinite(rawRate) ? rawRate : null;
  const isGstInvoice = flagged != null ? flagged : rate == null ? true : rate > 0;

  if (!isGstInvoice) {
    return { is_gst_invoice: false, gstPercent: 0 };
  }

  const gstPercent = rate != null && rate > 0 ? rate : 18;
  return { is_gst_invoice: true, gstPercent };
}

function isGstInvoiceSale(sale) {
  const flagged = parseBoolFlag(sale?.is_gst_invoice);
  if (flagged != null) return flagged;
  return Number(sale?.gst_percent) > 0;
}

/** Discount is taken off the subtotal first; GST is charged on what is left. */
function computeSaleGstTotals(subtotal, gstPercent, discount = 0) {
  const taxable = Math.max(0, Number(subtotal) - (Number(discount) || 0));
  const gstAmount = (taxable * Number(gstPercent || 0)) / 100;
  return {
    taxable,
    gstAmount,
    total: taxable + gstAmount,
  };
}

/**
 * Resolve the discount in rupees from { discount_type: 'percent' | 'amount', discount_value }.
 * Never negative, never more than the subtotal.
 */
function resolveSaleDiscount(subtotal, body) {
  const value = Math.max(0, Number(body?.discount_value) || 0);
  const type = body?.discount_type === 'percent' ? 'percent' : 'amount';
  const gross = Number(subtotal) || 0;
  const raw = type === 'percent' ? (gross * Math.min(value, 100)) / 100 : value;
  return Math.round(Math.min(Math.max(raw, 0), gross) * 100) / 100;
}

module.exports = {
  parseBoolFlag,
  resolveSaleGst,
  isGstInvoiceSale,
  computeSaleGstTotals,
  resolveSaleDiscount,
};
