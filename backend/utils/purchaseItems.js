function generateSku(name) {
  const prefix = (name || 'PRD')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 4)
    .toUpperCase();
  const suffix = Date.now().toString(36).slice(-6).toUpperCase();
  return `${prefix || 'PRD'}-${suffix}`;
}

function parsePackSizeLabel(pack) {
  const label = (pack || '500 ML').trim();
  if (label.endsWith(' L')) {
    return { unit_size: parseFloat(label.replace(' L', '')) || 1, unit_type: 'L' };
  }
  if (label.endsWith(' ML')) {
    return { unit_size: parseFloat(label.replace(' ML', '')) || 100, unit_type: 'ML' };
  }
  if (pack && pack.unit_size != null && pack.unit_type) {
    return { unit_size: Number(pack.unit_size), unit_type: pack.unit_type };
  }
  return { unit_size: 500, unit_type: 'ML' };
}

function normalizeFragrance(value) {
  const raw = (value || 'Unscented').toString().trim();
  if (!raw || raw === 'Other') return 'Unscented';
  return raw.slice(0, 80);
}

/**
 * Resolve purchase line items: create products when product_name is sent instead of product_id.
 * Variants are unique by name + pack size + fragrance (separate stock per variant).
 */
async function resolvePurchaseLineItems(supabase, items, { supplierName = '' } = {}) {
  const resolved = [];

  for (const item of items || []) {
    const quantity = parseInt(item.quantity, 10);
    const rate = parseFloat(item.rate);

    if (!quantity || quantity < 1) {
      throw new Error('Each line item must have quantity of at least 1');
    }
    if (Number.isNaN(rate) || rate < 0) {
      throw new Error('Each line item must have a valid rate');
    }

    if (item.product_id) {
      resolved.push({
        product_id: Number(item.product_id),
        quantity,
        rate,
      });
      continue;
    }

    const name = (item.product_name || '').trim();
    if (!name) {
      throw new Error('Select an existing product or enter a name for a new product');
    }

    const { unit_size, unit_type } = parsePackSizeLabel(item.pack_size || item);
    const fragrance = normalizeFragrance(item.fragrance);

    const { data: existing, error: lookupError } = await supabase
      .from('products')
      .select('id')
      .eq('name', name)
      .eq('unit_size', unit_size)
      .eq('unit_type', unit_type)
      .eq('fragrance', fragrance)
      .maybeSingle();

    if (lookupError) {
      throw new Error(lookupError.message);
    }

    if (existing) {
      resolved.push({
        product_id: existing.id,
        quantity,
        rate,
      });
      continue;
    }

    const { data: product, error } = await supabase
      .from('products')
      .insert({
        name,
        category: (item.category || 'General').trim(),
        price: rate,
        cost_price: rate,
        stock_quantity: 0,
        supplier: supplierName || (item.supplier || '').trim(),
        unit_type,
        unit_size,
        sku: generateSku(name),
        description: '',
        fragrance,
        hsn_sac: (item.hsn_sac || '').trim(),
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Could not create product "${name}": ${error.message}`);
    }

    resolved.push({
      product_id: product.id,
      quantity,
      rate,
    });
  }

  if (resolved.length === 0) {
    throw new Error('At least one line item is required');
  }

  return resolved;
}

module.exports = {
  resolvePurchaseLineItems,
};
