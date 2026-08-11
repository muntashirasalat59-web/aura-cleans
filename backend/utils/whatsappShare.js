/**
 * WhatsApp invoice share helpers — phone normalize + storage upload.
 */

const { getSupabaseAdmin } = require('../database/supabaseAdmin');

const INVOICES_BUCKET = 'invoices';

/**
 * Normalize Indian mobile to digits for wa.me (country code + number, no +).
 * Accepts 10-digit, 0-prefixed, or already 91-prefixed numbers.
 * @returns {string|null} e.g. "919876543210" or null if invalid
 */
function normalizeIndiaWhatsAppPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;

  let national = digits;
  if (national.startsWith('91') && national.length >= 12) {
    national = national.slice(2);
  } else if (national.startsWith('0') && national.length >= 11) {
    national = national.replace(/^0+/, '');
  }

  // Take last 10 digits (handles accidental extra digits)
  if (national.length > 10) {
    national = national.slice(-10);
  }

  if (national.length !== 10) return null;
  return `91${national}`;
}

function formatAmountInr(amount) {
  const n = Number(amount) || 0;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function buildWhatsAppInvoiceMessage({ invoiceNumber, amount, pdfUrl, partyName }) {
  const lines = [
    partyName ? `Hi ${partyName},` : 'Hi,',
    `Please find your invoice *${invoiceNumber}*.`,
    `Amount: *${formatAmountInr(amount)}*`,
    '',
    `Download PDF: ${pdfUrl}`,
  ];
  return lines.join('\n');
}

function buildWhatsAppShareUrl(phoneE164Digits, message) {
  return `https://wa.me/${phoneE164Digits}?text=${encodeURIComponent(message)}`;
}

async function ensureInvoicesBucket(admin) {
  const { data: buckets, error: listError } = await admin.storage.listBuckets();
  if (listError) {
    console.warn('[invoices] listBuckets:', listError.message);
  }
  const exists = (buckets || []).some((b) => b.name === INVOICES_BUCKET);
  if (exists) return;

  const { error: createError } = await admin.storage.createBucket(INVOICES_BUCKET, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ['application/pdf'],
  });

  if (createError && !/already exists|duplicate/i.test(createError.message || '')) {
    throw new Error(
      `Could not create Storage bucket "invoices": ${createError.message}. Create it in Supabase Dashboard (public) or run supabase.migration.invoices_storage.sql.`
    );
  }
}

/**
 * Upload invoice PDF buffer; returns public URL (cache-busted).
 */
async function uploadInvoicePdf({ businessId, saleId, invoiceNumber, pdfBuffer }) {
  const admin = getSupabaseAdmin();
  await ensureInvoicesBucket(admin);

  const safeName = String(invoiceNumber || `sale-${saleId}`)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80);
  const folder = businessId || 'shared';
  const filePath = `${folder}/${saleId}_${safeName}.pdf`;

  const { error: uploadError } = await admin.storage.from(INVOICES_BUCKET).upload(filePath, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: true,
  });

  if (uploadError) {
    throw new Error(`Invoice PDF upload failed: ${uploadError.message}`);
  }

  const { data: publicUrlData } = admin.storage.from(INVOICES_BUCKET).getPublicUrl(filePath);
  return `${publicUrlData.publicUrl}?v=${Date.now()}`;
}

module.exports = {
  INVOICES_BUCKET,
  normalizeIndiaWhatsAppPhone,
  buildWhatsAppInvoiceMessage,
  buildWhatsAppShareUrl,
  uploadInvoicePdf,
  ensureInvoicesBucket,
};
