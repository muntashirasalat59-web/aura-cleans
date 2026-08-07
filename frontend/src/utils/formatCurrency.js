/** Compact Indian rupee display — e.g. ₹8.4L, ₹24.6k */
export function formatCompactRupee(amount) {
  const n = Number(amount) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}k`;
  return `${sign}₹${abs.toLocaleString('en-IN')}`;
}

export function formatRupee(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}
