/** Line total before tax */
export function lineSubtotal(quantity, rate) {
  return Number(quantity || 0) * Number(rate || 0);
}

/** Whether this sale/preview should show GST (TAX INVOICE). */
export function isGstInvoice(saleOrFlag, gstPercent) {
  if (saleOrFlag && typeof saleOrFlag === 'object') {
    if (saleOrFlag.is_gst_invoice === false) return false;
    if (saleOrFlag.is_gst_invoice === true) return true;
    return Number(saleOrFlag.gst_percent) > 0;
  }
  if (saleOrFlag === false) return false;
  if (saleOrFlag === true) return true;
  return Number(gstPercent) > 0;
}

/** Subtotal, GST, and grand total for invoice-style forms */
export function computeGstTotals(items, gstPercent) {
  const subtotal = (items || []).reduce(
    (sum, item) => sum + lineSubtotal(item.quantity, item.rate),
    0
  );
  const rate = Number(gstPercent) || 0;
  const gstAmount = (subtotal * rate) / 100;
  return {
    subtotal,
    gstAmount,
    total: subtotal + gstAmount,
  };
}
