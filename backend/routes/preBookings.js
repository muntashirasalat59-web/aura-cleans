const express = require('express');
const router = express.Router();
const { assertNoError } = require('../database/supabase');
const { logActivity } = require('../utils/activityLog');
const {
  isMissingTableError,
  dateOnly,
  localTodayISO,
  mapPreBookingRow,
} = require('../utils/preBookings');

const STATUSES = ['upcoming', 'delivered', 'cancelled'];
const LIST_SELECT = '*, parties(name), products(name, unit_size, unit_type)';

function migrationHint() {
  return 'Run backend/database/supabase.migration.pre_bookings.sql in the Supabase SQL editor.';
}

function handleMissingTable(res, error) {
  if (!isMissingTableError(error)) return false;
  res.status(503).json({ error: `Pre-bookings table is not set up yet. ${migrationHint()}` });
  return true;
}

function businessIdOf(req) {
  return String(req.profile?.business_id || '').trim();
}

function validateBody(body) {
  const partyId = Number(body?.party_id);
  const productId = Number(body?.product_id);
  const quantity = Number(body?.quantity);
  const deliveryDate = dateOnly(body?.delivery_date);

  if (!partyId) return 'Party is required';
  if (!productId) return 'Product is required';
  if (!Number.isFinite(quantity) || quantity <= 0) return 'Quantity must be greater than 0';
  if (!deliveryDate) return 'Delivery date is required';
  return null;
}

async function fetchOne(db, id) {
  let { data, error } = await db.from('pre_bookings').select(LIST_SELECT).eq('id', id).maybeSingle();
  if (error && /parties|products|relationship|schema cache/i.test(error.message || '')) {
    ({ data, error } = await db.from('pre_bookings').select('*').eq('id', id).maybeSingle());
  }
  return { data, error };
}

async function listPreBookings(db, businessId) {
  let query = db.from('pre_bookings').select(LIST_SELECT).order('delivery_date', { ascending: true });
  if (businessId) query = query.eq('business_id', businessId);

  let { data, error } = await query;
  if (error && /parties|products|relationship|schema cache/i.test(error.message || '')) {
    let fallback = db.from('pre_bookings').select('*').order('delivery_date', { ascending: true });
    if (businessId) fallback = fallback.eq('business_id', businessId);
    ({ data, error } = await fallback);
  }
  return { data, error };
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
    if (handleMissingTable(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const db = req.db;
    if (!db) return res.status(401).json({ error: 'Authentication required' });

    const bid = businessIdOf(req);
    if (!bid) return res.status(400).json({ error: 'Business is required' });

    const validationError = validateBody(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const payload = {
      business_id: bid,
      party_id: Number(req.body.party_id),
      product_id: Number(req.body.product_id),
      quantity: Number(req.body.quantity),
      booking_date: dateOnly(req.body.booking_date) || localTodayISO(),
      delivery_date: dateOnly(req.body.delivery_date),
      notes: String(req.body.notes || '').trim(),
      status: 'upcoming',
    };

    const { data, error } = await db.from('pre_bookings').insert(payload).select().single();
    if (handleMissingTable(res, error)) return;
    assertNoError(error);

    const { data: full, error: refetchError } = await fetchOne(db, data.id);
    if (refetchError) {
      if (handleMissingTable(res, refetchError)) return;
      assertNoError(refetchError);
    }

    const row = mapPreBookingRow(full || data);
    await logActivity(req, {
      actionType: 'create',
      entityType: 'pre_booking',
      entityId: row.id,
      entityName: `${row.party_name} · ${row.product_name}`,
      details: { quantity: row.quantity, delivery_date: row.delivery_date },
    });
    res.status(201).json(row);
  } catch (error) {
    if (handleMissingTable(res, error)) return;
    res.status(500).json({ error: error.message });
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
    entityName: `${row.party_name} · ${row.product_name}`,
    details: { status: nextStatus },
  });
  res.json(row);
}

router.patch('/:id/deliver', async (req, res) => {
  try {
    await updateStatus(req, res, 'delivered');
  } catch (error) {
    if (handleMissingTable(res, error)) return;
    res.status(500).json({ error: error.message || 'Failed to mark as delivered' });
  }
});

router.patch('/:id/cancel', async (req, res) => {
  try {
    await updateStatus(req, res, 'cancelled');
  } catch (error) {
    if (handleMissingTable(res, error)) return;
    res.status(500).json({ error: error.message || 'Failed to cancel pre-booking' });
  }
});

module.exports = router;
