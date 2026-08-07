const express = require('express');
const router = express.Router();
const { assertNoError } = require('../database/supabase');
const {
  productDeleteBlockedMessage,
  isFkViolation,
} = require('../utils/recordLifecycle');
const { logActivity } = require('../utils/activityLog');

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
    let query = req.db.from('products').select('*').order('name');

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
    const { data, error } = await req.db
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
    const { data, error } = await req.db
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
    const { data, error } = await req.db.from('products').select('*').eq('id', req.params.id).maybeSingle();
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

    const payload = {
      ...normalizeProductPayload(req.body),
      is_active: true,
      business_id: req.profile.business_id,
    };

    const { data, error } = await req.db.from('products').insert(payload).select().single();

    assertNoError(error);
    await logActivity(req, {
      actionType: 'create',
      entityType: 'product',
      entityId: data.id,
      entityName: data.name,
      details: { category: data.category },
    });
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: fetchError } = await req.db
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    assertNoError(fetchError);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const payload = normalizeProductPayload(req.body, existing);

    const { data, error } = await req.db.from('products').update(payload).eq('id', id).select().single();

    assertNoError(error);
    await logActivity(req, {
      actionType: 'update',
      entityType: 'product',
      entityId: data.id,
      entityName: data.name,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const productId = Number(req.params.id);
    if (!Number.isFinite(productId)) {
      return res.status(400).json({ error: 'Invalid product id' });
    }

    const { data: existing, error: fetchError } = await req.db
      .from('products')
      .select('id, name')
      .eq('id', productId)
      .maybeSingle();

    assertNoError(fetchError);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const { data, error } = await req.db.rpc('delete_product_smart', {
      p_product_id: productId,
    });

    if (error && /could not find the function|does not exist/i.test(error.message || '')) {
      return res.status(503).json({
        error:
          'delete_product_smart RPC is missing. Run backend/database/supabase.migration.delete_product_smart.sql in Supabase SQL Editor.',
        code: 'RPC_MISSING',
      });
    }

    assertNoError(error);

    const result = data || {};
    const status = result.status;

    if (status === 'not_found') {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (status === 'blocked_has_sales') {
      const saleItems = Number(result.sale_items) || 0;
      return res.status(409).json({
        error: productDeleteBlockedMessage({ saleItems, purchaseItems: 0 }),
        code: 'LINKED_RECORDS',
        status: 'blocked_has_sales',
        links: { saleItems, purchaseItems: 0 },
      });
    }

    if (status !== 'deleted') {
      return res.status(500).json({
        error: 'Unexpected delete_product_smart response',
        result,
      });
    }

    const purchaseItemsRemoved = Number(result.purchase_items_removed) || 0;
    const purchasesRemoved = Number(result.purchases_removed) || 0;
    let message = `Product "${result.product_name || existing.name}" deleted successfully.`;
    if (purchaseItemsRemoved > 0) {
      message += ` Removed ${purchaseItemsRemoved} purchase line item(s)`;
      if (purchasesRemoved > 0) {
        message += ` (${purchasesRemoved} purchase record(s) cleared)`;
      }
      message += '.';
    }

    const productName = result.product_name || existing.name;
    await logActivity(req, {
      actionType: 'delete',
      entityType: 'product',
      entityId: productId,
      entityName: productName,
      details: { purchase_items_removed: purchaseItemsRemoved, purchases_removed: purchasesRemoved },
    });

    res.json({
      success: true,
      status: 'deleted',
      message,
      product_id: result.product_id ?? productId,
      product_name: productName,
      purchase_items_removed: purchaseItemsRemoved,
      purchases_removed: purchasesRemoved,
    });
  } catch (error) {
    if (isFkViolation(error)) {
      return res.status(409).json({
        error: productDeleteBlockedMessage({ saleItems: 1, purchaseItems: 0 }),
        code: 'LINKED_RECORDS',
      });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;