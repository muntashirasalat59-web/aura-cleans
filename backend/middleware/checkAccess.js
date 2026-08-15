function hasValidAccess(profile) {
  if (!profile) return false;
  if (profile.is_platform_admin) return true;

  if (profile.payment_status === 'paid') return true;

  const now = new Date();
  const hasTrial = Boolean(profile.trial_ends_at);
  const hasSub = Boolean(profile.subscription_ends_at);

  // Accounts created before trial dates existed stay open.
  if (!hasTrial && !hasSub) return true;

  const trialValid = hasTrial && new Date(profile.trial_ends_at) > now;
  const subValid = hasSub && new Date(profile.subscription_ends_at) > now;
  return Boolean(trialValid || subValid);
}

function checkAccess(req, res, next) {
  if (hasValidAccess(req.profile)) {
    return next();
  }
  return res.status(402).json({
    error: 'Your trial has ended. Send a message to our team to continue.',
    code: 'TRIAL_EXPIRED',
  });
}

function requirePlatformAdmin(req, res, next) {
  if (!req.profile?.is_platform_admin) {
    return res.status(403).json({ error: 'Platform admin access required' });
  }
  next();
}

module.exports = { checkAccess, hasValidAccess, requirePlatformAdmin };
