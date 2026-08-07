const path = require('path');
const fs = require('fs');

const FONT_DIR = path.join(__dirname, '../assets/fonts');
const FONT_REGULAR = path.join(FONT_DIR, 'NotoSans-Regular.ttf');
const FONT_BOLD = path.join(FONT_DIR, 'NotoSans-Bold.ttf');
const RUPEE = '\u20B9';

/** Register Noto Sans — includes the Indian Rupee (₹) glyph for PDFKit. */
function registerInvoiceFonts(doc) {
  if (!fs.existsSync(FONT_REGULAR)) {
    throw new Error(
      `Invoice PDF font not found at ${FONT_REGULAR}. Re-download NotoSans-Regular.ttf into backend/assets/fonts.`
    );
  }

  doc.registerFont('InvoiceRegular', FONT_REGULAR);
  doc.registerFont('InvoiceBold', fs.existsSync(FONT_BOLD) ? FONT_BOLD : FONT_REGULAR);
}

function formatInr(amount, { decimals = 2 } = {}) {
  const value = Number(amount) || 0;
  const formatted = value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${RUPEE}${formatted}`;
}

module.exports = { registerInvoiceFonts, formatInr, RUPEE };
