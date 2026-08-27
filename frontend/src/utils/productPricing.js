/** Existing `products.price` is the wholesale / B2B selling price. */
export function wholesalePrice(product) {
  return Number(product?.price) || 0;
}

/** Retail / consumer price. Falls back to wholesale when retail is missing or 0. */
export function retailPrice(product) {
  const retail = Number(product?.retail_price);
  if (Number.isFinite(retail) && retail > 0) return retail;
  return wholesalePrice(product);
}

export function catalogRate(product, priceType = 'wholesale') {
  if (!product) return 0;
  return priceType === 'retail' ? retailPrice(product) : wholesalePrice(product);
}
