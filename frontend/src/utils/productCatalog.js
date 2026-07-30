export const PACK_SIZE_OPTIONS = [
  '100 ML',
  '150 ML',
  '200 ML',
  '250 ML',
  '300 ML',
  '350 ML',
  '400 ML',
  '500 ML',
  '600 ML',
  '750 ML',
  '1 L',
  '1.25 L',
  '1.5 L',
  '2 L',
  '2.5 L',
  '3 L',
  '4 L',
  '5 L',
];

export const FRAGRANCE_OPTIONS = [
  'Lavender',
  'Lemon',
  'Rose',
  'Jasmine',
  'Sandalwood',
  'Ocean Breeze',
  'Fresh Cotton',
  'Unscented',
  'Other',
];

export function parsePackSize(pack) {
  if (pack.endsWith(' L')) {
    return {
      unit_size: parseFloat(pack.replace(' L', '')) || 1,
      unit_type: 'L',
    };
  }
  if (pack.endsWith(' ML')) {
    return {
      unit_size: parseFloat(pack.replace(' ML', '')) || 100,
      unit_type: 'ML',
    };
  }
  return { unit_size: 500, unit_type: 'ML' };
}

export function productToPackSize(product) {
  const size = Number(product.unit_size);
  const type = product.unit_type || 'ML';
  const label = type === 'L' ? `${size} L` : `${size} ${type}`;
  if (PACK_SIZE_OPTIONS.includes(label)) return label;
  return '500 ML';
}

/** Resolve fragrance from form fields (handles "Other" + custom name). */
export function resolveFragranceValue(fragrance, customFragrance = '') {
  if (fragrance === 'Other') {
    const custom = customFragrance.trim();
    if (!custom) return null;
    return custom.slice(0, 80);
  }
  return (fragrance || 'Unscented').trim();
}
