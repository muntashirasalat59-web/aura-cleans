/** Shared business details for invoices (edit for your firm). */
export const BUSINESS = {
  name: 'AURA CLEAN',
  tagline: 'Premium Cloud ERP — Cleaning & Hygiene',
  address: 'Your Business Address Line, City, State — PIN',
  gstin: '29XXXXX0000X1ZX',
  phone: '+91 XXXXX XXXXX',
};

export function businessGstLabel() {
  return `GSTIN: ${BUSINESS.gstin}`;
}
