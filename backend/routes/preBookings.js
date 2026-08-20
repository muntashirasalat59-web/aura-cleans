const express = require('express');
const router = express.Router();
const { assertNoError } = require('../database/supabase');
const { logActivity } = require('../utils/activityLog');
const {
  isMissingTableError,
  dateOnly,
  localTodayISO,
  money,
  mapPreBookingRow,
} = require('../utils/preBookings');

const STATUSES = ['upcoming', 'delivered', 'cancelled'];
const LIST_SELECT =
  '*, parties(name), pre_booking_items(id, product_id, quantity, rate, amount, products(name, unit_size, unit_type))';

function migrationHint() {
  return 'Run backend/database/supabase.migration.pre_bookings_items.sql in the Supabase SQL editor.';
}

function handleMissingTable(res, error) {
  if (!isMissingTableError(error)) return false;
  res.status(503).json({ error: `Pre-bookings line items are not set up yet. ${migrationHint()}` });
  return true;
}

function businessIdOf(req) {
  return String(req.profile?.business_id || '').trim();
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
      return { product_id, quantity, rate, amount: money(rate * quantity) };
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
  let { data, error } = await db.from('pre_bookings').select(LIST_SELECT).eq('id', id).maybeSingle();
  if (error && /pre_booking_items|relationship|schema cache/i.test(error.message || '')) {
    ({ data, error } = await db
      .from('pre_bookings')
      .select('*, parties(name)')
      .eq('id', id)
      .maybeSingle());
  }
  if (error && /parties|relationship/i.test(error.message || '')) {
    ({ data, error } = await db.from('pre_bookings').select('*').eq('id', id).maybeSingle());
  }
  return { data, error };
}

async function listPreBookings(db, businessId) {
  let query = db.from('pre_bookings').select(LIST_SELECT).order('delivery_date', { ascending: true });
  if (businessId) query = query.eq('business_id', businessId);

  let { data, error } = await query;
  if (error && /pre_booking_items|relationship|schema cache/i.test(error.message || '')) {
    let fallback = db.from('pre_bookings').select('*, parties(name)').order('delivery_date', { ascending: true });
    if (businessId) fallback = fallback.eq('business_id', businessId);
    ({ data, error } = await fallback);
  }
  if (error && /parties|relationship/i.test(error.message || '')) {
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

    const items = normalizeItems(req.body);
    const validationError = validateBody(req.body, items);
    if (validationError) return res.status(400).json({ error: validationError });

    const total_amount = money(items.reduce((sum, item) => sum + item.amount, 0));
    const header = {
      business_id: bid,
      party_id: Number(req.body.party_id),
      booking_date: dateOnly(req.body.booking_date) || localTodayISO(),
      delivery_date: dateOnly(req.body.delivery_date),
      notes: String(req.body.notes || '').trim(),
      status: 'upcoming',
      total_amount,
    };

    const { data, error } = await db.from('pre_bookings').insert(header).select().single();
    if (handleMissingTable(res, error)) return;
    assertNoError(error);

    const { error: itemsError } = await db.from('pre_booking_items').insert(
      items.map((item) => ({
        pre_booking_id: data.id,
        product_id: item.product_id,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
      }))
    );
    if (itemsError) {
      await db.from('pre_bookings').delete().eq('id', data.id);
      if (handleMissingTable(res, itemsError)) return;
      assertNoError(itemsError);
    }

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
      entityName: `${row.party_name} · ${row.item_count} item${row.item_count === 1 ? '' : 's'}`,
      details: { item_count: row.item_count, total_amount: row.total_amount, delivery_date: row.delivery_date },
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
    entityName: `${row.party_name} · ${row.item_count} item${row.item_count === 1 ? '' : 's'}`,
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
