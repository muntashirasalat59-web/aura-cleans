/** Map Supabase / auth errors to safe user-facing messages (no credential hints). */
export function mapAuthError(error) {
  const message = String(error?.message || error || '').toLowerCase();

  if (
    message.includes('invalid login credentials') ||
    message.includes('invalid email or password') ||
    message.includes('invalid credentials') ||
    message.includes('wrong password') ||
    message.includes('user not found')
  ) {
    return 'Invalid phone, email, or password';
  }

  if (
    message.includes('email not confirmed') ||
    message.includes('confirm your email') ||
    message.includes('verify your email')
  ) {
    return 'Please verify your email first. Check your inbox.';
  }

  if (message.includes('too many requests') || message.includes('rate limit')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'Cannot reach authentication service. Check your connection and try again.';
  }

  if (message.includes('profile not found') || message.includes('not provisioned')) {
    return 'Account not provisioned. Contact your administrator.';
  }

  return 'Invalid phone, email, or password';
}
