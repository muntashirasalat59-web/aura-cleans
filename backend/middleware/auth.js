const { supabase, createClientWithToken, assertNoError, getDbClient } = require('../database/supabase');
const { getSupabaseAdmin } = require('../database/supabaseAdmin');

const PROFILE_CACHE_TTL_MS = 30_000;
const profileCache = new Map();

function decodeJwtSub(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    return payload.sub || null;
  } catch {
    return null;
  }
}

function getCachedAuth(userId) {
  const entry = profileCache.get(userId);
  if (!entry || Date.now() > entry.expiresAt) {
    profileCache.delete(userId);
    return null;
  }
  return entry;
}

function setCachedAuth(userId, authUser, profile) {
  profileCache.set(userId, {
    authUser,
    profile,
    expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
  });
}

function mergeBusinessFields(profile) {
  if (!profile) return profile;
  const biz = profile.businesses;
  if (!biz) return profile;
  const row = Array.isArray(biz) ? biz[0] : biz;
  const { businesses, ...rest } = profile;
  return {
    ...rest,
    payment_status: row?.payment_status || rest.payment_status || null,
    business_name: row?.business_name || rest.business_name || null,
  };
}

const PROFILE_SELECT = '*, businesses(payment_status, business_name)';

async function fetchUserProfile(userId, accessToken) {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('user_profiles')
      .select(PROFILE_SELECT)
      .eq('id', userId)
      .maybeSingle();
    assertNoError(error);
    if (data) return mergeBusinessFields(data);
  } catch (err) {
    if (!String(err.message).includes('SUPABASE_SERVICE_ROLE_KEY')) {
      throw err;
    }
  }

  const userClient = createClientWithToken(accessToken);
  const { data: profile, error: profileError } = await userClient
    .from('user_profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle();

  assertNoError(profileError);
  return mergeBusinessFields(profile);
}

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.slice(7);
    const userId = decodeJwtSub(token);
    if (!userId) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const cached = getCachedAuth(userId);
    if (cached) {
      req.authUser = cached.authUser;
      req.profile = cached.profile;
      req.accessToken = token;
      req.db = getDbClient(token);
      return next();
    }

    const [userResult, profile] = await Promise.all([
      supabase.auth.getUser(token),
      fetchUserProfile(userId, token),
    ]);

    if (userResult.error || !userResult.data?.user) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    if (!profile) {
      return res.status(403).json({ error: 'User profile not found. Contact your administrator.' });
    }

    const authUser = userResult.data.user;
    setCachedAuth(userId, authUser, profile);

    req.authUser = authUser;
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
