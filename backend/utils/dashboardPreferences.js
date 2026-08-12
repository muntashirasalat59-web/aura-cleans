const { getDbClient, assertNoError } = require('../database/supabase');

function emptyResponse() {
  return { layout: null, updated_at: null };
}

async function fetchDashboardLayout(accessToken, userId) {
  if (!userId) return emptyResponse();
  const db = getDbClient(accessToken);
  const { data, error } = await db
    .from('user_dashboard_preferences')
    .select('layout_json, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (
      error.code === 'PGRST205' ||
      error.code === '42P01' ||
      /schema cache|does not exist|relation/i.test(error.message || '')
    ) {
      const err = new Error(
        'user_dashboard_preferences table missing. Run supabase.migration.user_dashboard_preferences.sql in Supabase SQL Editor.'
      );
      err.code = 'PREFS_TABLE_MISSING';
      throw err;
    }
    assertNoError(error);
  }

  if (!data) return emptyResponse();
  return {
    layout: data.layout_json && typeof data.layout_json === 'object' ? data.layout_json : null,
    updated_at: data.updated_at || null,
  };
}

async function upsertDashboardLayout(accessToken, userId, layout) {
  if (!userId) {
    const err = new Error('User not found');
    err.code = 'NO_USER';
    throw err;
  }
  if (!layout || typeof layout !== 'object') {
    const err = new Error('layout must be a JSON object');
    err.code = 'INVALID_LAYOUT';
    throw err;
  }

  const db = getDbClient(accessToken);
  const payload = {
    user_id: userId,
    layout_json: layout,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from('user_dashboard_preferences')
    .upsert(payload, { onConflict: 'user_id' })
    .select('layout_json, updated_at')
    .single();

  if (error) {
    if (
      error.code === 'PGRST205' ||
      error.code === '42P01' ||
      /schema cache|does not exist|relation/i.test(error.message || '')
    ) {
      const err = new Error(
        'user_dashboard_preferences table missing. Run supabase.migration.user_dashboard_preferences.sql in Supabase SQL Editor.'
      );
      err.code = 'PREFS_TABLE_MISSING';
      throw err;
    }
    assertNoError(error);
  }

  return {
    layout: data.layout_json,
    updated_at: data.updated_at,
  };
}

async function deleteDashboardLayout(accessToken, userId) {
  if (!userId) return emptyResponse();
  const db = getDbClient(accessToken);
  const { error } = await db.from('user_dashboard_preferences').delete().eq('user_id', userId);

  if (error) {
    if (
      error.code === 'PGRST205' ||
      error.code === '42P01' ||
      /schema cache|does not exist|relation/i.test(error.message || '')
    ) {
      const err = new Error(
        'user_dashboard_preferences table missing. Run supabase.migration.user_dashboard_preferences.sql in Supabase SQL Editor.'
      );
      err.code = 'PREFS_TABLE_MISSING';
      throw err;
    }
    assertNoError(error);
  }

  return emptyResponse();
}

module.exports = {
  fetchDashboardLayout,
  upsertDashboardLayout,
  deleteDashboardLayout,
};
