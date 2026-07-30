/** Line total before tax */
export function lineSubtotal(quantity, rate) {
  return Number(quantity || 0) * Number(rate || 0);
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
