const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getSupabaseAdmin } = require('../database/supabaseAdmin');
const { supabase } = require('../database/supabase');
const {
  normalizeEmail,
  isValidEmailFormat,
  confirmationRedirectTo,
} = require('../utils/email');

const DUPLICATE_EMAIL = {
  error: 'An account with this email already exists. Sign in instead.',
  code: 'EMAIL_EXISTS',
};

router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.authUser.id,
      email: req.authUser.email,
    },
    profile: req.profile,
  });
});

function isDuplicateAuthError(message) {
  return /already registered|already exists|already been registered|user already/i.test(
    message || ''
  );
}

function isRateLimitError(message) {
  return /rate limit|only request this after|too many/i.test(message || '');
}

async function sendSignupConfirmation(email, redirectTo) {
  const options = redirectTo ? { emailRedirectTo: redirectTo } : undefined;
  const first = await supabase.auth.resend({
    type: 'signup',
    email,
    options,
  });
  if (!first.error) return null;

  // Retry without redirect URL — uses Supabase Site URL if redirect is not allowlisted.
  if (redirectTo && /redirect|whitelist|allow/i.test(first.error.message || '')) {
    console.warn('[auth] confirmation redirect rejected, retrying with Site URL:', first.error.message);
    const retry = await supabase.auth.resend({ type: 'signup', email });
    return retry.error || null;
  }
  return first.error;
}

function signupFail(res, status, err, fallback) {
  const message = (err && (err.message || err.error)) || fallback || 'Could not create account. Please try again.';
  console.error('[auth] signup failed:', message, err?.code || '', err?.details || '');
  return res.status(status).json({
    error: message,
    code: err?.code || null,
    detail: err?.details || err?.hint || null,
  });
}

router.post('/signup', async (req, res) => {
  try {
    const { business_name, full_name, email, password } = req.body;

    if (!business_name?.trim() || !full_name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Business name, name, email and password are required' });
    }
    if (!isValidEmailFormat(email)) {
      return res.status(400).json({ error: 'Enter a valid email address', code: 'INVALID_EMAIL' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = normalizeEmail(email);
    const admin = getSupabaseAdmin();
    const redirectTo = confirmationRedirectTo(req);
    console.log('[auth] signup start', { email: normalizedEmail, redirectTo });

    const { data: existingProfile, error: lookupError } = await admin
      .from('user_profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (lookupError) {
      return signupFail(res, 500, lookupError, 'Could not check existing account.');
    }
    if (existingProfile) {
      return res.status(409).json(DUPLICATE_EMAIL);
    }

    // Admin create does not send mail, so SMTP/rate-limit cannot block account creation.
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: false,
      user_metadata: {
        full_name: full_name.trim(),
        business_name: business_name.trim(),
      },
    });
    if (authError) {
      if (isDuplicateAuthError(authError.message)) {
        return res.status(409).json(DUPLICATE_EMAIL);
      }
      return signupFail(res, 400, authError);
    }

    const userId = authData.user.id;

    const { data: business, error: bizError } = await admin
      .from('businesses')
      .insert({
        business_name: business_name.trim(),
        owner_email: normalizedEmail,
        status: 'active',
        subscription_amount: 999,
        payment_status: 'unpaid',
      })
      .select()
      .single();

    if (bizError) {
      await admin.auth.admin.deleteUser(userId);
      return signupFail(res, 500, bizError);
    }

    const { error: profileError } = await admin.from('user_profiles').insert({
      id: userId,
      full_name: full_name.trim(),
      email: normalizedEmail,
      role: 'admin',
      business_id: business.id,
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      await admin.from('businesses').delete().eq('id', business.id);
      return signupFail(res, 500, profileError);
    }

    const sendError = await sendSignupConfirmation(normalizedEmail, redirectTo);
    if (sendError) {
      console.warn('[auth] confirmation email not sent:', sendError.message);
    }

    res.status(201).json({
      needs_email_confirmation: true,
      email: normalizedEmail,
      email_send_warning: sendError ? sendError.message : null,
      message: sendError
        ? `Account created, but the confirmation email could not be sent yet (${sendError.message}). Use Resend email in a minute.`
        : "We've sent a confirmation link to your email. Please verify to activate your account.",
      business_id: business.id,
    });
  } catch (err) {
    return signupFail(res, 500, err);
  }
});

router.post('/resend-confirmation', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmailFormat(email)) {
      return res.status(400).json({ error: 'Enter a valid email address', code: 'INVALID_EMAIL' });
    }

    const redirectTo = confirmationRedirectTo(req);
    const sendError = await sendSignupConfirmation(email, redirectTo);

    if (sendError && /already confirmed|already been confirmed/i.test(sendError.message || '')) {
      return res.status(200).json({
        already_confirmed: true,
        message: 'This email is already verified. Sign in instead.',
      });
    }

    if (sendError && isRateLimitError(sendError.message)) {
      return res.status(429).json({
        error: `Please wait a moment before requesting another email. (${sendError.message})`,
        code: 'EMAIL_RATE_LIMIT',
      });
    }

    if (sendError) {
      console.warn('[auth] resend failed:', sendError.message);
      return res.status(400).json({ error: sendError.message });
    }

    res.json({
      message: "If this email still needs verification, we've sent another confirmation link.",
    });
  } catch (err) {
    console.error('[auth] resend exception:', err.message);
    res.status(500).json({ error: err.message || 'Could not resend confirmation email. Please try again.' });
  }
});

module.exports = router;
