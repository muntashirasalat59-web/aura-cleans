export function hasPaidSubscription(profile) {
  if (!profile) return false;
  if (profile.payment_status === 'paid') return true;
  return Boolean(profile.subscription_ends_at && new Date(profile.subscription_ends_at) > new Date());
}

export function hasValidAccess(profile) {
  if (!profile) return false;
  if (profile.is_platform_admin) return true;
  if (hasPaidSubscription(profile)) return true;

  const now = new Date();
  const hasTrial = Boolean(profile.trial_ends_at);
  const hasSub = Boolean(profile.subscription_ends_at);

  if (!hasTrial && !hasSub) return true;

  const trialValid = hasTrial && new Date(profile.trial_ends_at) > now;
  const subValid = hasSub && new Date(profile.subscription_ends_at) > now;
  return Boolean(trialValid || subValid);
}

/** Sidebar trial chip. Null when paid or not on a trial. */
export function getTrialSidebarState(profile) {
  if (!profile || profile.is_platform_admin || hasPaidSubscription(profile)) return null;
  if (!profile.trial_ends_at) return null;

  const daysLeft = Math.ceil(
    (new Date(profile.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)
  );
  if (daysLeft > 0) return { kind: 'active', daysLeft };
  return { kind: 'expired' };
}
