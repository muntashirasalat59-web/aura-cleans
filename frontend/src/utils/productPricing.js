/** Existing `products.price` is the wholesale / B2B selling price. */
export function wholesalePrice(product) {
  return Number(product?.price) || 0;
}

/** Stored retail / consumer price only. 0 when missing — no wholesale fallback. */
export function listedRetailPrice(product) {
  const retail = Number(product?.retail_price);
  return Number.isFinite(retail) && retail > 0 ? retail : 0;
}

export function hasRetailPrice(product) {
  return listedRetailPrice(product) > 0;
}

/** Retail / consumer price. Falls back to wholesale when retail is missing or 0. */
export function retailPrice(product) {
  const listed = listedRetailPrice(product);
  if (listed > 0) return listed;
  return wholesalePrice(product);
}

export function catalogRate(product, priceType = 'wholesale') {
  if (!product) return 0;
  return priceType === 'retail' ? retailPrice(product) : wholesalePrice(product);
}
