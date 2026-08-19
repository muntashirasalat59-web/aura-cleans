const express = require('express');
const router = express.Router();
const { assertNoError } = require('../database/supabase');
const { requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLog');
const {
  listBusinessCities,
  ensureDefaultCity,
  missingCitiesTable,
} = require('../utils/businessCities');

function migrationHint() {
  return 'Run backend/database/supabase.migration.business_cities.sql in the Supabase SQL editor.';
}

function handleMissingTable(res, error) {
  if (!missingCitiesTable(error)) return false;
  res.status(503).json({ error: `Cities table is not set up yet. ${migrationHint()}` });
  return true;
}

function normalizeCityName(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function businessIdOf(req) {
  return String(req.profile?.business_id || '').trim();
}

router.get('/', async (req, res) => {
  try {
    const bid = businessIdOf(req);
    if (!bid) return res.status(400).json({ error: 'Business is required' });

    const activeOnly = String(req.query.active_only || '') === 'true';
    let rows = await ensureDefaultCity(req.db, bid);
    if (activeOnly) {
      rows = rows.filter((c) => c.is_active !== false);
    }
    res.json(rows);
  } catch (error) {
    if (handleMissingTable(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const bid = businessIdOf(req);
    if (!bid) return res.status(400).json({ error: 'Business is required' });

    const city_name = normalizeCityName(req.body?.city_name);
    if (!city_name) {
      return res.status(400).json({ error: 'City name is required' });
    }

    await ensureDefaultCity(req.db, bid);

    const { data, error } = await req.db
      .from('business_cities')
      .insert({ business_id: bid, city_name, is_active: true })
      .select()
      .single();

    if (error) {
      if (handleMissingTable(res, error)) return;
      if (/duplicate/i.test(error.message || '')) {
        return res.status(409).json({ error: 'That city is already in your list.' });
      }
      assertNoError(error);
    }

    await logActivity(req, {
      actionType: 'create',
      entityType: 'business_city',
      entityId: data.id,
      entityName: data.city_name,
    });
    res.status(201).json(data);
  } catch (error) {
    if (handleMissingTable(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const bid = businessIdOf(req);
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid city id' });

    const { data: existing, error: fetchError } = await req.db
      .from('business_cities')
      .select('*')
      .eq('id', id)
      .eq('business_id', bid)
      .maybeSingle();
    if (handleMissingTable(res, fetchError)) return;
    assertNoError(fetchError);
    if (!existing) return res.status(404).json({ error: 'City not found' });

    const patch = {};
    if (req.body?.city_name != null) {
      const city_name = normalizeCityName(req.body.city_name);
      if (!city_name) return res.status(400).json({ error: 'City name is required' });
      patch.city_name = city_name;
    }
    if (req.body?.is_active != null) {
      const nextActive = Boolean(req.body.is_active);
      if (!nextActive) {
        const cities = await listBusinessCities(req.db, bid);
        const otherActive = cities.filter((c) => c.id !== id && c.is_active !== false);
        if (otherActive.length === 0) {
          return res.status(400).json({ error: 'Keep at least one active city.' });
        }
      }
      patch.is_active = nextActive;
    }
    if (!Object.keys(patch).length) {
      return res.json(existing);
    }

    const { data, error } = await req.db
      .from('business_cities')
      .update(patch)
      .eq('id', id)
      .eq('business_id', bid)
      .select()
      .single();
    if (error) {
      if (/duplicate/i.test(error.message || '')) {
        return res.status(409).json({ error: 'That city is already in your list.' });
      }
      assertNoError(error);
    }

    await logActivity(req, {
      actionType: 'update',
      entityType: 'business_city',
      entityId: id,
      entityName: data.city_name,
      details: patch,
    });
    res.json(data);
  } catch (error) {
    if (handleMissingTable(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const bid = businessIdOf(req);
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid city id' });

    const cities = await listBusinessCities(req.db, bid);
    const existing = cities.find((c) => Number(c.id) === id);
    if (!existing) return res.status(404).json({ error: 'City not found' });
    if (cities.length <= 1) {
      return res.status(400).json({ error: 'Keep at least one city.' });
    }

    const { count, error: countError } = await req.db
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('city_id', id);
    if (countError && !missingCitiesTable(countError)) {
      assertNoError(countError);
    }
    const used = Number(count) > 0;

    if (used) {
      const otherActive = cities.filter((c) => c.id !== id && c.is_active !== false);
      if (otherActive.length === 0 && existing.is_active !== false) {
        return res.status(400).json({
          error: 'This city has invoices. Add or activate another city before removing it.',
        });
      }
      const { data, error } = await req.db
        .from('business_cities')
        .update({ is_active: false })
        .eq('id', id)
        .eq('business_id', bid)
        .select()
        .single();
      assertNoError(error);
      await logActivity(req, {
        actionType: 'update',
        entityType: 'business_city',
        entityId: id,
        entityName: existing.city_name,
        details: { deactivated: true, reason: 'in_use' },
      });
      return res.json({ ...data, deactivated: true });
    }

    const { error } = await req.db
      .from('business_cities')
      .delete()
      .eq('id', id)
      .eq('business_id', bid);
    assertNoError(error);
    await logActivity(req, {
      actionType: 'delete',
      entityType: 'business_city',
      entityId: id,
      entityName: existing.city_name,
    });
    res.json({ ok: true, id });
  } catch (error) {
    if (handleMissingTable(res, error)) return;
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
