const express = require('express');
const router = express.Router();
const { assertNoError } = require('../database/supabase');
const { logActivity } = require('../utils/activityLog');
const {
  isMissingTableError,
  dateOnly,
  money,
  publicErrorMessage,
  mapPreBookingRow,
  selectPreBookings,
} = require('../utils/preBookings');

const STATUSES = ['upcoming', 'delivered', 'cancelled'];
const DEFAULT_GST_RATE = 18;

function businessIdOf(req) {
  return String(req.profile?.business_id || '').trim();
}

function handleMissingTable(res, error) {
  if (!isMissingTableError(error)) return false;
  res.status(503).json({ error: publicErrorMessage(error) });
  return true;
}

function fail(res, error, fallbackStatus = 500) {
  if (handleMissingTable(res, error)) return true;
  const message = publicErrorMessage(error);
  const status =
    /required|at least one|greater than 0|cannot be negative|not found|not set up|rebuild|only upcoming/i.test(message)
      ? 400
      : fallbackStatus;
  res.status(status).json({ error: message });
  return true;
}

function resolveLineGst(item) {
  if (item?.gst_percent === undefined || item?.gst_percent === null || item?.gst_percent === '') {
    return DEFAULT_GST_RATE;
  }
  return Number(item.gst_percent) || 0;
}

function normalizeItems(body) {
  const raw = Array.isArray(body?.items) ? body.items : [];
  return raw
    .map((item) => {
      const product_id = Number(item?.product_id);
      const quantity = Number(item?.quantity);
      const rate = money(item?.rate);
      const gst_percent = resolveLineGst(item);
      if (!product_id || !Number.isFinite(quantity) || quantity <= 0) return null;
      if (!Number.isFinite(rate) || rate < 0) return null;
      if (!Number.isFinite(gst_percent) || gst_percent < 0) return null;
      return { product_id, quantity, rate, gst_percent };
    })
    .filter(Boolean);
}

function validateBody(body, items) {
  if (!Number(body?.party_id)) return 'Party is required';
  if (!dateOnly(body?.delivery_date)) return 'Delivery date is required';
  if (!items.length) return 'Add at least one product';
  return null;
}

async function fetchOne(db, id) {
  return selectPreBookings(db, { id });
}

async function listPreBookings(db, businessId) {
  return selectPreBookings(db, { businessId, order: true });
}

router.get('/', async (req, res) => {
  try {
    const db = req.db;
    if (!db) return res.status(401).json({ error: 'Authentication required' });

    const { data, error } = await listPreBookings(db, businessIdOf(req));
    if (handleMissingTable(res, error)) return;
    assertNoError(error);
    res.json((data || []).map(mapPreBookingRow));
  } catch (error) {
    fail(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = req.db;
    if (!db) return res.status(401).json({ error: 'Authentication required' });

    const { data, error } = await fetchOne(db, req.params.id);
    if (handleMissingTable(res, error)) return;
    assertNoError(error);
    if (!data) return res.status(404).json({ error: 'Pre-booking not found' });
    const bid = businessIdOf(req);
    if (bid && String(data.business_id) !== bid) {
      return res.status(404).json({ error: 'Pre-booking not found' });
    }
    res.json(mapPreBookingRow(data));
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

    const { data: createdId, error } = await db.rpc('create_pre_booking', {
      p_business_id: bid,
      p_party_id: Number(req.body.party_id),
      p_delivery_date: dateOnly(req.body.delivery_date),
      p_notes: String(req.body.notes || '').trim(),
      p_items: items,
    });
    if (error) return fail(res, error, 400);

    const { data: full, error: refetchError } = await fetchOne(db, createdId);
    if (refetchError) return fail(res, refetchError);

    const row = mapPreBookingRow(full);
    await logActivity(req, {
      actionType: 'create',
      entityType: 'pre_booking',
      entityId: row.id,
      entityName: `${row.party_name} · ${row.item_count} item${row.item_count === 1 ? '' : 's'}`,
      details: {
        item_count: row.item_count,
        subtotal: row.subtotal,
        gst_total: row.gst_total,
        total_amount: row.total_amount,
        delivery_date: row.delivery_date,
      },
    });
    res.status(201).json(row);
  } catch (error) {
    fail(res, error);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const db = req.db;
    if (!db) return res.status(401).json({ error: 'Authentication required' });

    const bid = businessIdOf(req);
    if (!bid) return res.status(400).json({ error: 'Business is required' });

    const items = normalizeItems(req.body);
    const validationError = validateBody(req.body, items);
    if (validationError) return res.status(400).json({ error: validationError });

    const { error } = await db.rpc('update_pre_booking', {
      p_id: Number(req.params.id),
      p_business_id: bid,
      p_party_id: Number(req.body.party_id),
      p_delivery_date: dateOnly(req.body.delivery_date),
      p_notes: String(req.body.notes || '').trim(),
      p_items: items,
    });
    if (error) return fail(res, error, 400);

    const { data: full, error: refetchError } = await fetchOne(db, req.params.id);
    if (refetchError) return fail(res, refetchError);
    if (!full) return res.status(404).json({ error: 'Pre-booking not found' });

    const row = mapPreBookingRow(full);
    await logActivity(req, {
      actionType: 'update',
      entityType: 'pre_booking',
      entityId: row.id,
      entityName: `${row.party_name} · ${row.item_count} item${row.item_count === 1 ? '' : 's'}`,
      details: {
        item_count: row.item_count,
        subtotal: row.subtotal,
        gst_total: row.gst_total,
        total_amount: row.total_amount,
        delivery_date: row.delivery_date,
      },
    });
    res.json(row);
  } catch (error) {
    fail(res, error);
  }
});

async function updateStatus(req, res, nextStatus) {
  if (!STATUSES.includes(nextStatus)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const db = req.db;
  if (!db) return res.status(401).json({ error: 'Authentication required' });

  const id = req.params.id;
  const { data: existing, error: fetchError } = await fetchOne(db, id);
  if (handleMissingTable(res, fetchError)) return;
  assertNoError(fetchError);
  if (!existing) return res.status(404).json({ error: 'Pre-booking not found' });

  const { error } = await db.from('pre_bookings').update({ status: nextStatus }).eq('id', id);
  if (handleMissingTable(res, error)) return;
  assertNoError(error);

  const { data: updated, error: refetchError } = await fetchOne(db, id);
  if (refetchError) {
    if (handleMissingTable(res, refetchError)) return;
    assertNoError(refetchError);
  }

  const row = mapPreBookingRow(updated || { ...existing, status: nextStatus });
  await logActivity(req, {
    actionType: nextStatus === 'delivered' ? 'mark_delivered' : 'cancel',
    entityType: 'pre_booking',
    entityId: row.id,
    entityName: `${row.party_name} · ${row.item_count} item${row.item_count === 1 ? '' : 's'}`,
    details: { status: nextStatus },
  });
  res.json(row);
}

router.patch('/:id/deliver', async (req, res) => {
  try {
    await updateStatus(req, res, 'delivered');
  } catch (error) {
    fail(res, error);
  }
});

router.patch('/:id/cancel', async (req, res) => {
  try {
    await updateStatus(req, res, 'cancelled');
  } catch (error) {
    fail(res, error);
  }
});

module.exports = router;
