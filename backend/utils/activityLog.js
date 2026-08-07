const { supabase } = require('../database/supabase');

function activityClient() {
  try {
    const { getSupabaseAdmin } = require('../database/supabaseAdmin');
    return getSupabaseAdmin();
  } catch {
    return supabase;
  }
}

/**
 * Best-effort audit write — never throws to the caller.
 * Uses req.authUser / req.profile from requireAuth.
 */
async function logActivity(req, {
  actionType,
  entityType,
  entityId = null,
  entityName = '',
  details = null,
} = {}) {
  try {
    if (!actionType || !entityType) return;

    const userId = req?.profile?.id || req?.authUser?.id || null;
    const userName =
      (req?.profile?.full_name || '').trim() ||
      (req?.authUser?.email || '').trim() ||
      'Unknown user';

    const row = {
      user_id: userId,
      user_name: userName,
      business_id: req?.profile?.business_id || null,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId == null || entityId === '' ? null : String(entityId),
      entity_name: String(entityName || '').slice(0, 240),
      details: details && typeof details === 'object' ? details : null,
    };

    const db = activityClient();
    const { error } = await db.from('activity_log').insert(row);
    if (error) {
      if (/relation .*activity_log.* does not exist|could not find the table/i.test(error.message || '')) {
        console.warn(
          '[activityLog] table missing — run backend/database/supabase.migration.activity_log.sql'
        );
        return;
      }
      console.warn('[activityLog] insert failed:', error.message);
    }
  } catch (err) {
    console.warn('[activityLog]', err.message || err);
  }
}

module.exports = { logActivity };