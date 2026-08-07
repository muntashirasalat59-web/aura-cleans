/** Shared helpers for invoices — letterhead lives in business_settings (DB). */

function isRealBusinessValue(value) {
  if (value == null) return false;
  const s = String(value).trim();
  if (!s) return false;
  if (/X{3,}/i.test(s)) return false;
  if (/^(n\/a|na|none|tbd|pending)$/i.test(s)) return false;
  return true;
}

function splitGst(gstPercent, gstAmount) {
  const rate = Number(gstPercent) || 0;
  const amount = Number(gstAmount) || 0;
  return {
    cgstRate: rate / 2,
    sgstRate: rate / 2,
    cgstAmount: amount / 2,
    sgstAmount: amount / 2,
  };
}

module.exports = {
  splitGst,
  isRealBusinessValue,
};
