/**
 * Build premium invoice PDF as a Buffer (reuse renderPremiumInvoicePdf).
 */

const PDFDocument = require('pdfkit');
const { registerInvoiceFonts } = require('./pdfInvoice');
const { renderPremiumInvoicePdf, PDF_PAGE } = require('./renderInvoicePdf');

function buildInvoicePdfBuffer(sale, business) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument(PDF_PAGE);
      registerInvoiceFonts(doc);
      doc.font('InvoiceRegular');

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      renderPremiumInvoicePdf(doc, sale, business)
        .then(() => doc.end())
        .catch(reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { buildInvoicePdfBuffer };
