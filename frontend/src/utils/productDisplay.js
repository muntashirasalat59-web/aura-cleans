/** Pack size label from product row, e.g. "500 ML" or "5 L". */
export function formatPackSize(product) {
  if (!product) return '';
  const size = product.unit_size;
  const type = product.unit_type;
  if (!type) return '';
  if (size == null || size === '') return type;
  return `${Number(size)} ${type}`;
}

/**
 * Product name + pack size in a consistent format.
 * @param {'paren'|'dash'|'inline'} style — (500 ML) | - 500 ML | 500 ML appended
 */
export function formatProductNameWithSize(product, style = 'paren') {
  const name = (product?.name || product?.product_name || '').trim();
  const size = formatPackSize(product);
  if (!name) return '—';
  if (!size) return name;
  if (style === 'dash') return `${name} - ${size}`;
  if (style === 'inline') return `${name} ${size}`;
  return `${name} (${size})`;
}

/** Dropdown label: "Hand Wash - 500 ML - Lavender (Stock: 290)" */
export function formatProductOptionLabel(product, { stock, price, showFragrance = true } = {}) {
  const name = (product?.name || product?.product_name || '').trim();
  const size = formatPackSize(product);
  const fragrance = (product?.fragrance || '').trim();

  let label = name || 'Product';
  if (size) label += ` - ${size}`;
  if (showFragrance && fragrance) label += ` - ${fragrance}`;
  if (stock != null) label += ` (Stock: ${stock})`;
  if (price != null) label += ` — ₹${Number(price).toLocaleString('en-IN')}`;
  return label;
}

/** Dashboard-style quantity + size, e.g. "300 × 500 ML". */
export function formatQuantityWithSize(quantity, product) {
  const size = formatPackSize(product);
  const qty = Number(quantity) || 0;
  if (!size) return `${qty} units`;
  return `${qty.toLocaleString('en-IN')} × ${size}`;
}
