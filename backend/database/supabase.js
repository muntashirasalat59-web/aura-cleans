require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_ANON_KEY in backend/.env'
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** User-scoped client: JWT is sent on every PostgREST request (RLS auth.uid() works). */
function createClientWithToken(accessToken) {
  if (!accessToken) {
    throw new Error('accessToken is required');
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    accessToken: async () => accessToken,
  });
}

function assertNoError(error) {
  if (error) {
    const err = new Error(error.message || 'Database error');
    err.code = error.code;
    err.details = error.details;
    throw err;
  }
}

const { getSupabaseAdmin } = require('./supabaseAdmin');

/** Prefer user JWT so RLS (auth.uid()) is enforced. */
function getDbClient(accessToken) {
  if (!accessToken) {
    throw new Error('Database client unavailable. Sign in again.');
  }
  return createClientWithToken(accessToken);
}

module.exports = { supabase, createClientWithToken, assertNoError, getDbClient };