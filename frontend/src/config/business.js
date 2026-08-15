/** Invoice helpers — company letterhead comes from Business Settings API, not this file. */

export const INVOICE_FOOTER_NOTE = 'Thank you for your business.';

/** Default payment due offset (days) when creating invoices. */
export const DEFAULT_PAYMENT_DUE_DAYS = 15;

/** True when a config value is non-empty and not a masked placeholder (e.g. +91 XXXXX XXXXX). */
export function isRealBusinessValue(value) {
  if (value == null) return false;
  const s = String(value).trim();
  if (!s) return false;
  if (/X{3,}/i.test(s)) return false;
  if (/^(n\/a|na|none|tbd|pending)$/i.test(s)) return false;
  return true;
}

export function formatDisplayDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function computeDueDate(invoiceDate, days = DEFAULT_PAYMENT_DUE_DAYS) {
  if (!invoiceDate) return null;
  const d = new Date(`${invoiceDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + (Number(days) || 0));
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatBusinessAddress(settings) {
  if (!settings) return '';
  const cityState = [settings.city, settings.state].map((s) => String(s || '').trim()).filter(Boolean).join(', ');
  return [settings.address_line1, settings.address_line2, cityState]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(', ');
}

/** Street/city only — state is shown on its own invoice line. */
export function formatBusinessStreetAddress(settings) {
  if (!settings) return '';
  const street = [settings.address_line1, settings.address_line2, settings.city]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(', ');
  return street || formatBusinessAddress(settings);
}

export function businessGstLabel(settings) {
  const gstin = String(settings?.gstin || '').trim();
  return gstin ? `GSTIN: ${gstin}` : '';
}

/** @deprecated Prefer Business Settings API — kept only for rare static fallbacks. */
export const BUSINESS = {
  paymentDueDays: DEFAULT_PAYMENT_DUE_DAYS,
  footerNote: INVOICE_FOOTER_NOTE,
};
