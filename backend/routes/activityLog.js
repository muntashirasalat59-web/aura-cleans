const express = require('express');
const { assertNoError } = require('../database/supabase');

const router = express.Router();
const PAGE_SIZE = 50;

function activityDb(req) {
  try {
    const { getSupabaseAdmin } = require('../database/supabaseAdmin');
    return getSupabaseAdmin();
  } catch {
    return req.db;
  }
}

/** GET /api/activity-log?limit=&offset=&user_id=&action_type=&entity_type=&from=&to= */
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || PAGE_SIZE, 1),
      100
    );
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const { user_id, action_type, entity_type, from, to } = req.query;

    const db = activityDb(req);
    let query = db
      .from('activity_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (user_id) query = query.eq('user_id', user_id);
    if (action_type) query = query.eq('action_type', action_type);
    if (entity_type) query = query.eq('entity_type', entity_type);
    if (from) query = query.gte('created_at', `${from}T00:00:00.000Z`);
    if (to) query = query.lte('created_at', `${to}T23:59:59.999Z`);

    const { data, error, count } = await query;

    if (error) {
      if (/relation .*activity_log.* does not exist|could not find the table/i.test(error.message || '')) {
        return res.status(503).json({
          error:
            'activity_log table missing. Run backend/database/supabase.migration.activity_log.sql in Supabase SQL Editor.',
          code: 'TABLE_MISSING',
        });
      }
      assertNoError(error);
    }

    res.json({
      items: data || [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load activity log' });
  }
});

/** Distinct actors for filter dropdown */
router.get('/actors', async (req, res) => {
  try {
    const db = activityDb(req);
    const { data, error } = await db
      .from('activity_log')
      .select('user_id, user_name')
      .not('user_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      if (/relation .*activity_log.* does not exist|could not find the table/i.test(error.message || '')) {
        return res.json([]);
      }
      assertNoError(error);
    }

    const seen = new Map();
    for (const row of data || []) {
      if (row.user_id && !seen.has(row.user_id)) {
        seen.set(row.user_id, {
          id: row.user_id,
          name: row.user_name || 'Unknown',
        });
      }
    }
    res.json([...seen.values()].sort((a, b) => a.name.localeCompare(b.name)));
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load actors' });
  }
});

module.exports = router;
