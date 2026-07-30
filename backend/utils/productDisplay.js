function formatPackSize(product) {
  if (!product) return '';
  const size = product?.unit_size;
  const type = product?.unit_type;
  if (!type) return '';
  if (size == null || size === '') return type;
  return `${Number(size)} ${type}`;
}

function formatProductNameWithSize(product, style = 'inline') {
  const name = (product?.name || product?.product_name || '').trim();
  const size = formatPackSize(product);
  if (!name) return '—';
  if (!size) return name;
  if (style === 'dash') return `${name} - ${size}`;
  if (style === 'paren') return `${name} (${size})`;
  return `${name} ${size}`;
}

module.exports = {
  formatPackSize,
  formatProductNameWithSize,
};
