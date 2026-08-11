/**
 * Build premium invoice PDF as a Buffer (reuse renderPremiumInvoicePdf).
 */

const PDFDocument = require('pdfkit');
const { registerInvoiceFonts } = require('./pdfInvoice');
const { renderPremiumInvoicePdf } = require('./renderInvoicePdf');

function buildInvoicePdfBuffer(sale, business) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      registerInvoiceFonts(doc);
      doc.font('InvoiceRegular');

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      renderPremiumInvoicePdf(doc, sale, business);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { buildInvoicePdfBuffer };
