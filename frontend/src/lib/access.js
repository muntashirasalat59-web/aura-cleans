export function hasValidAccess(profile) {
  if (!profile) return false;
  if (profile.is_platform_admin) return true;

  const now = new Date();
  const hasTrial = Boolean(profile.trial_ends_at);
  const hasSub = Boolean(profile.subscription_ends_at);

  if (!hasTrial && !hasSub) return true;

  const trialValid = hasTrial && new Date(profile.trial_ends_at) > now;
  const subValid = hasSub && new Date(profile.subscription_ends_at) > now;
  return Boolean(trialValid || subValid);
}
