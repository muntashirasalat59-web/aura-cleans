  const { supabase, createClientWithToken, assertNoError, getDbClient } = require('../database/supabase');
const { getSupabaseAdmin } = require('../database/supabaseAdmin');

async function fetchUserProfile(userId, accessToken) {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    assertNoError(error);
    if (data) return data;
  } catch (err) {
    if (!String(err.message).includes('SUPABASE_SERVICE_ROLE_KEY')) {
      throw err;
    }
  }

  const userClient = createClientWithToken(accessToken);
  const { data: profile, error: profileError } = await userClient
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  assertNoError(profileError);
  return profile;
}

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.slice(7);
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const profile = await fetchUserProfile(data.user.id, token);

    if (!profile) {
      return res.status(403).json({ error: 'User profile not found. Contact your administrator.' });
    }

    req.authUser = data.user;
    req.profile = profile;
    req.accessToken = token;
    req.db = getDbClient(token);
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function requireAdmin(req, res, next) {
  if (req.profile?.role !== 'admin' && req.profile?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/** List/create/delete users — uses service role when available for admin table access */
async function loadAllProfiles() {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('user_profiles').select('*').order('created_at', { ascending: false });
    assertNoError(error);
    return data;
  } catch {
    return null;
  }
}

module.exports = { requireAuth, requireAdmin, loadAllProfiles };
