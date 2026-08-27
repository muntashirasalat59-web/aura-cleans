const express = require('express');
const router = express.Router();
const { assertNoError } = require('../database/supabase');
const { logActivity } = require('../utils/activityLog');
const {
  money,
  dateOnly,
  isMissingOffersError,
  publicErrorMessage,
  mapOfferRow,
  OFFER_SELECT,
  OFFER_SELECT_NO_BOOKINGS,
  selectWithoutItemRate,
} = require('../utils/offers');

function businessIdOf(req) {
  return String(req.profile?.business_id || '').trim();
}

function handleMissing(res, error) {
  if (!isMissingOffersError(error)) return false;
  res.status(503).json({ error: publicErrorMessage(error) });
  return true;
}

function fail(res, error, fallbackStatus = 500) {
  if (handleMissing(res, error)) return true;
  const message = publicErrorMessage(error);
  const status =
    /required|at least one|greater than 0|cannot|not found|not set up|Valid from|retail rate/i.test(message)
      ? 400
      : fallbackStatus;
  res.status(status).json({ error: message });
  return true;
}

function normalizeItems(body) {
  const raw = Array.isArray(body?.items) ? body.items : [];
  return raw
    .map((item) => {
      const product_id = Number(item?.product_id);
      const quantity = Number(item?.quantity);
      const rate = money(item?.rate);
      if (!product_id || !Number.isFinite(quantity) || quantity <= 0) return null;
      if (!Number.isFinite(rate) || rate < 0) return null;
      if (item?.rate === '' || item?.rate === undefined || item?.rate === null) return null;
      return { product_id, quantity, rate };
    })
    .filter(Boolean);
}

function validateBody(body, items) {
  if (!String(body?.offer_name || '').trim()) return 'Offer name is required';
  const combo = Number(body?.combo_price);
  if (!Number.isFinite(combo) || combo < 0) return 'Combo price cannot be negative';
  if (!items.length) return 'Add at least one product';
  const rawWithProduct = (Array.isArray(body?.items) ? body.items : []).filter((item) =>
    Number(item?.product_id)
  );
  if (
    rawWithProduct.some(
      (item) =>
        item?.rate === '' ||
        item?.rate === undefined ||
        item?.rate === null ||
        !Number.isFinite(Number(item.rate)) ||
        Number(item.rate) < 0
    )
  ) {
    return 'Each product needs a retail rate';
  }
  const from = dateOnly(body?.valid_from);
  const to = dateOnly(body?.valid_to);
  if (from && to && from > to) return 'Valid from cannot be after valid to';
  return null;
}

async function selectOffers(db, { id, businessId } = {}) {
  async function run(select) {
    let query = db.from('offers').select(select);
    if (id) query = query.eq('id', id);
    if (businessId) query = query.eq('business_id', businessId);
    query = query.order('created_at', { ascending: false });
    return id ? query.maybeSingle() : query;
  }

  let { data, error } = await run(OFFER_SELECT);
  if (error && /offer_items.*rate|column.*rate/i.test(error.message || '')) {
    ({ data, error } = await run(selectWithoutItemRate(OFFER_SELECT)));
    if (!error) {
      console.warn('[offers] offer_items.rate missing — run supabase.migration.offer_items_rate.sql');
    }
  }
  if (error && /pre_bookings|offer_id/i.test(error.message || '')) {
    ({ data, error } = await run(OFFER_SELECT_NO_BOOKINGS));
    if (error && /offer_items.*rate|column.*rate/i.test(error.message || '')) {
      ({ data, error } = await run(selectWithoutItemRate(OFFER_SELECT_NO_BOOKINGS)));
    }
  }
  return { data, error };
}

async function replaceItems(db, offerId, items) {
  const { error: delError } = await db.from('offer_items').delete().eq('offer_id', offerId);
  assertNoError(delError);
  if (!items.length) return;
  const payload = items.map((item) => ({
    offer_id: offerId,
    product_id: item.product_id,
    quantity: item.quantity,
    rate: money(item.rate),
  }));
  let { error } = await db.from('offer_items').insert(payload);
  if (error && /rate/i.test(error.message || '')) {
    console.warn('[offers] offer_items.rate missing — run supabase.migration.offer_items_rate.sql');
    ({ error } = await db.from('offer_items').insert(
      payload.map(({ rate, ...rest }) => rest)
    ));
  }
  assertNoError(error);
}

async function fetchMapped(db, id, businessId) {
  const { data, error } = await selectOffers(db, { id, businessId });
  if (error) return { error };
  if (!data) return { data: null };
  return { data: mapOfferRow(data) };
}

router.get('/', async (req, res) => {
  try {
    const db = req.db;
    if (!db) return res.status(401).json({ error: 'Authentication required' });

    const { data, error } = await selectOffers(db, { businessId: businessIdOf(req) });
    if (handleMissing(res, error)) return;
    assertNoError(error);
    let rows = (Array.isArray(data) ? data : []).map(mapOfferRow);
    if (req.query.active_only === 'true') {
      const today = dateOnly(new Date().toISOString());
      rows = rows.filter((row) => {
        if (!row.is_active) return false;
        if (row.valid_from && row.valid_from > today) return false;
        if (row.valid_to && row.valid_to < today) return false;
        return true;
      });
    }
    res.json(rows);
  } catch (error) {
    fail(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = req.db;
    if (!db) return res.status(401).json({ error: 'Authentication required' });

    const { data, error } = await fetchMapped(db, req.params.id, businessIdOf(req));
    if (handleMissing(res, error)) return;
    assertNoError(error);
    if (!data) return res.status(404).json({ error: 'Offer not found' });
    res.json(data);
  } catch (error) {
    fail(res, error);
  }
});

router.post('/', async (req, res) => {
  try {
    const db = req.db;
    if (!db) return res.status(401).json({ error: 'Authentication required' });

    const bid = businessIdOf(req);
    if (!bid) return res.status(400).json({ error: 'Business is required' });

    const items = normalizeItems(req.body);
    const validationError = validateBody(req.body, items);
    if (validationError) return res.status(400).json({ error: validationError });

    const { data: created, error } = await db
      .from('offers')
      .insert({
        business_id: bid,
        offer_name: String(req.body.offer_name).trim(),
        combo_price: money(req.body.combo_price),
        valid_from: dateOnly(req.body.valid_from),
        valid_to: dateOnly(req.body.valid_to),
        is_active: req.body.is_active === false ? false : true,
      })
      .select('id')
      .single();
    if (error) return fail(res, error, 400);

    try {
      await replaceItems(db, created.id, items);
    } catch (itemError) {
      await db.from('offers').delete().eq('id', created.id);
      return fail(res, itemError, 400);
    }

    const { data: full, error: refetchError } = await fetchMapped(db, created.id, bid);
    if (refetchError) return fail(res, refetchError);

    await logActivity(req, {
      actionType: 'create',
      entityType: 'offer',
      entityId: full.id,
      entityName: full.offer_name,
      details: { combo_price: full.combo_price, item_count: full.item_count },
    });
    res.status(201).json(full);
  } catch (error) {
    fail(res, error);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const db = req.db;
    if (!db) return res.status(401).json({ error: 'Authentication required' });

    const bid = businessIdOf(req);
    const items = normalizeItems(req.body);
    const validationError = validateBody(req.body, items);
    if (validationError) return res.status(400).json({ error: validationError });

    const { data: existing, error: fetchError } = await db
      .from('offers')
      .select('id, business_id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (handleMissing(res, fetchError)) return;
    assertNoError(fetchError);
    if (!existing || (bid && String(existing.business_id) !== bid)) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    const { error } = await db
      .from('offers')
      .update({
        offer_name: String(req.body.offer_name).trim(),
        combo_price: money(req.body.combo_price),
        valid_from: dateOnly(req.body.valid_from),
        valid_to: dateOnly(req.body.valid_to),
        is_active: req.body.is_active === false ? false : true,
      })
      .eq('id', existing.id);
    if (error) return fail(res, error, 400);

    await replaceItems(db, existing.id, items);

    const { data: full, error: refetchError } = await fetchMapped(db, existing.id, bid);
    if (refetchError) return fail(res, refetchError);

    await logActivity(req, {
      actionType: 'update',
      entityType: 'offer',
      entityId: full.id,
      entityName: full.offer_name,
      details: { combo_price: full.combo_price, item_count: full.item_count },
    });
    res.json(full);
  } catch (error) {
    fail(res, error);
  }
});

async function setActive(req, res, isActive) {
  const db = req.db;
  if (!db) return res.status(401).json({ error: 'Authentication required' });

  const bid = businessIdOf(req);
  const { data: existing, error: fetchError } = await db
    .from('offers')
    .select('id, business_id, offer_name')
    .eq('id', req.params.id)
    .maybeSingle();
  if (handleMissing(res, fetchError)) return;
  assertNoError(fetchError);
  if (!existing || (bid && String(existing.business_id) !== bid)) {
    return res.status(404).json({ error: 'Offer not found' });
  }

  const { error } = await db.from('offers').update({ is_active: isActive }).eq('id', existing.id);
  if (handleMissing(res, error)) return;
  assertNoError(error);

  const { data: full, error: refetchError } = await fetchMapped(db, existing.id, bid);
  if (refetchError) return fail(res, refetchError);

  await logActivity(req, {
    actionType: 'update',
    entityType: 'offer',
    entityId: existing.id,
    entityName: existing.offer_name,
    details: { is_active: isActive },
  });
  res.json(full);
}

router.post('/:id/deactivate', async (req, res) => {
  try {
    await setActive(req, res, false);
  } catch (error) {
    fail(res, error);
  }
});

router.post('/:id/reactivate', async (req, res) => {
  try {
    await setActive(req, res, true);
  } catch (error) {
    fail(res, error);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = req.db;
    if (!db) return res.status(401).json({ error: 'Authentication required' });

    const bid = businessIdOf(req);
    const { data: existing, error: fetchError } = await db
      .from('offers')
      .select('id, business_id, offer_name')
      .eq('id', req.params.id)
      .maybeSingle();
    if (handleMissing(res, fetchError)) return;
    assertNoError(fetchError);
    if (!existing || (bid && String(existing.business_id) !== bid)) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    const { error } = await db.from('offers').delete().eq('id', existing.id);
    if (handleMissing(res, error)) return;
    assertNoError(error);

    await logActivity(req, {
      actionType: 'delete',
      entityType: 'offer',
      entityId: existing.id,
      entityName: existing.offer_name,
    });
    res.json({ ok: true, id: existing.id });
  } catch (error) {
    fail(res, error);
  }
});

module.exports = router;
