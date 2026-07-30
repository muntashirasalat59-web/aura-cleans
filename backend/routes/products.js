const express = require('express');
const router = express.Router();
const { supabase, assertNoError } = require('../database/supabase');
const {
  countProductLinks,
  hasProductLinks,
  productDeleteBlockedMessage,
  isFkViolation,
  genericFkMessage,
} = require('../utils/recordLifecycle');

const UNIT_TYPES = ['ML', 'L', 'KG', 'Gram', 'Piece', 'Box', 'Dozen'];

const FRAGRANCE_OPTIONS = [
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

function normalizeFragrance(value, existing = null) {
  const raw = (value ?? existing?.fragrance ?? 'Unscented').toString().trim();
  if (!raw || raw === 'Other') {
    return 'Unscented';
  }
  return raw.slice(0, 80);
}

function generateSku(name) {
  const prefix = (name || 'PRD')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 4)
    .toUpperCase();
  const suffix = Date.now().toString(36).slice(-6).toUpperCase();
  return `${prefix || 'PRD'}-${suffix}`;
}

function normalizeProductPayload(body, existing = null) {
  const name = body.name ?? existing?.name;
  const category = body.category ?? existing?.category;

  let unitType = body.unit_type ?? existing?.unit_type ?? 'Piece';
  if (!UNIT_TYPES.includes(unitType)) {
    unitType = 'Piece';
  }

  let sku = body.sku ?? existing?.sku ?? '';
  if (typeof sku === 'string') {
    sku = sku.trim();
  }
  if (!sku && !existing) {
    sku = generateSku(name);
  }

  const payload = {
    name,
    category,
    price: parseFloat(body.price ?? existing?.price ?? 0) || 0,
    cost_price: parseFloat(body.cost_price ?? existing?.cost_price ?? 0) || 0,
    stock_quantity: parseInt(body.stock_quantity ?? existing?.stock_quantity ?? 0, 10) || 0,
    supplier: (body.supplier ?? existing?.supplier ?? '').trim(),
    unit_type: unitType,
    unit_size: parseFloat(body.unit_size ?? existing?.unit_size ?? 1) || 1,
    sku: sku || null,
    description: (body.description ?? existing?.description ?? '').trim(),
    fragrance: normalizeFragrance(body.fragrance, existing),
    hsn_sac: (body.hsn_sac ?? existing?.hsn_sac ?? '').toString().trim().slice(0, 20),
  };

  if (body.is_active !== undefined) {
    payload.is_active = Boolean(body.is_active);
  }

  return payload;
}

router.get('/', async (req, res) => {
  try {
    const { active_only, status } = req.query;
    let query = supabase.from('products').select('*').order('name');

    if (active_only === 'true' || status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    const { data, error } = await query;
    assertNoError(error);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .maybeSingle();

    assertNoError(error);
    if (!data) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deactivated successfully', product: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/reactivate', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('products')
      .update({ is_active: true })
      .eq('id', id)
      .select()
      .maybeSingle();

    assertNoError(error);
    if (!data) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product reactivated successfully', product: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('products').select('*').eq('id', req.params.id).maybeSingle();
    assertNoError(error);
    if (!data) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, category } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }

    const payload = { ...normalizeProductPayload(req.body), is_active: true };

    const { data, error } = await supabase.from('products').insert(payload).select().single();

    assertNoError(error);
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    assertNoError(fetchError);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const payload = normalizeProductPayload(req.body, existing);

    const { data, error } = await supabase.from('products').update(payload).eq('id', id).select().single();

    assertNoError(error);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabase
      .from('products')
      .select('id, name')
      .eq('id', id)
      .maybeSingle();

    assertNoError(fetchError);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const links = await countProductLinks(supabase, id);
    if (hasProductLinks(links)) {
      return res.status(409).json({
        error: productDeleteBlockedMessage(links),
        code: 'LINKED_RECORDS',
        links,
      });
    }

    const { data, error } = await supabase.from('products').delete().eq('id', id).select('id');

    if (error) {
      if (isFkViolation(error)) {
        return res.status(409).json({
          error: productDeleteBlockedMessage(links) || genericFkMessage('product'),
          code: 'LINKED_RECORDS',
        });
      }
      assertNoError(error);
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    if (isFkViolation(error)) {
      return res.status(409).json({ error: genericFkMessage('product'), code: 'LINKED_RECORDS' });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
