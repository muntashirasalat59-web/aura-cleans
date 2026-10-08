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

/** Discount in rupees from { type: 'percent' | 'amount', value }; capped at the subtotal. */
export function resolveDiscountAmount(subtotal, discount) {
  const value = Math.max(0, Number(discount?.value) || 0);
  const gross = Number(subtotal) || 0;
  const raw = discount?.type === 'percent' ? (gross * Math.min(value, 100)) / 100 : value;
  return Math.round(Math.min(Math.max(raw, 0), gross) * 100) / 100;
}

/**
 * Subtotal, discount, GST, and grand total for invoice-style forms.
 * The discount comes off the subtotal first; GST is charged on the discounted amount.
 */
export function computeGstTotals(items, gstPercent, discount = null) {
  const subtotal = (items || []).reduce(
    (sum, item) => sum + lineSubtotal(item.quantity, item.rate),
    0
  );
  const discountAmount = resolveDiscountAmount(subtotal, discount);
  const taxable = subtotal - discountAmount;
  const rate = Number(gstPercent) || 0;
  const gstAmount = (taxable * rate) / 100;
  return {
    subtotal,
    discountAmount,
    gstAmount,
    total: taxable + gstAmount,
  };
}
