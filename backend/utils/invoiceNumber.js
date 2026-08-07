/**
 * Invoice numbers: INV-{YYYY}-{NNN} (zero-padded, sequential).
 * Soft-deleted rows still occupy numbers (UNIQUE on invoice_number).
 */

function parseInvoiceSuffix(invoiceNumber) {
  if (!invoiceNumber) return 0;
  const parts = String(invoiceNumber).trim().split('-');
  // INV-2026-002 → ["INV","2026","002"]
  if (parts.length < 3) return 0;
  const n = parseInt(parts[parts.length - 1], 10);
  return Number.isNaN(n) ? 0 : n;
}

function formatInvoiceNumber(year, suffix) {
  return `INV-${year}-${String(suffix).padStart(3, '0')}`;
}

/**
 * @param {Array<{ invoice_number?: string }>} rows
 * @param {number} [atLeast=0] last tried suffix to skip past on retry
 * @param {number} [year]
 */
function nextInvoiceNumberFromRows(rows, atLeast = 0, year = new Date().getFullYear()) {
  let maxNum = 0;
  for (const row of rows || []) {
    maxNum = Math.max(maxNum, parseInvoiceSuffix(row.invoice_number));
  }
  const nextNum = Math.max(maxNum, Number(atLeast) || 0) + 1;
  return formatInvoiceNumber(year, nextNum);
}

function isDuplicateInvoiceNumberError(error) {
  const msg = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  const code = String(error?.code || '');
  return (
    code === '23505' ||
    msg.includes('sales_invoice_number_key') ||
    msg.includes('idx_sales_invoice_number') ||
    (msg.includes('duplicate key') && msg.includes('invoice_number'))
  );
}

module.exports = {
  parseInvoiceSuffix,
  formatInvoiceNumber,
  nextInvoiceNumberFromRows,
  isDuplicateInvoiceNumberError,
};
