/** Intra-state GST split: CGST + SGST (half rate each). */
export function splitGst(gstPercent, gstAmount) {
  const rate = Number(gstPercent) || 0;
  const amount = Number(gstAmount) || 0;
  const halfRate = rate / 2;
  const halfAmount = amount / 2;
  return {
    cgstRate: halfRate,
    sgstRate: halfRate,
    cgstAmount: halfAmount,
    sgstAmount: halfAmount,
  };
}

export function formatInr(value) {
  return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
