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

function computeSaleGstTotals(subtotal, gstPercent) {
  const gstAmount = (Number(subtotal) * Number(gstPercent || 0)) / 100;
  return {
    gstAmount,
    total: Number(subtotal) + gstAmount,
  };
}

module.exports = {
  parseBoolFlag,
  resolveSaleGst,
  isGstInvoiceSale,
  computeSaleGstTotals,
};
