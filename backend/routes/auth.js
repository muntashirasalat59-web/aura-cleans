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

async function sendSignupConfirmation(email, redirectTo) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) {
    console.warn('[auth] confirmation email failed:', error.message);
  }
  return error;
}

function isDuplicateAuthError(message) {
  return /already registered|already exists|already been registered|user already/i.test(
    message || ''
  );
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

    const { data: existingProfile } = await admin
      .from('user_profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (existingProfile) {
      return res.status(409).json(DUPLICATE_EMAIL);
    }

    const { data: signData, error: signError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          full_name: full_name.trim(),
          business_name: business_name.trim(),
        },
      },
    });
    if (signError) {
      if (isDuplicateAuthError(signError.message)) {
        return res.status(409).json(DUPLICATE_EMAIL);
      }
      console.error('[auth] signUp failed:', signError.message);
      return res.status(400).json({ error: 'Could not create account. Please try again.' });
    }

    const user = signData?.user;
    if (!user?.id) {
      return res.status(400).json({ error: 'Could not create account. Please try again.' });
    }

    // Existing email: Supabase may return a user with no identities (no enumeration leak).
    if (!user.identities || user.identities.length === 0) {
      return res.status(409).json(DUPLICATE_EMAIL);
    }

    const userId = user.id;

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
      return res.status(500).json({ error: 'Could not create account. Please try again.' });
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
      return res.status(500).json({ error: 'Could not create account. Please try again.' });
    }

    const confirmed =
      Boolean(signData.session) || Boolean(user.email_confirmed_at || user.confirmed_at);

    res.status(201).json({
      needs_email_confirmation: !confirmed,
      email: normalizedEmail,
      message: confirmed
        ? 'Account created successfully. You can now sign in.'
        : "We've sent a confirmation link to your email. Please verify to activate your account.",
      business_id: business.id,
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not create account. Please try again.' });
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

    if (sendError && /only request this after|rate limit|too many/i.test(sendError.message || '')) {
      return res.status(429).json({
        error: 'Please wait a moment before requesting another email.',
      });
    }

    // Same response whether or not the address exists — avoid account enumeration.
    res.json({
      message: "If this email still needs verification, we've sent another confirmation link.",
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not resend confirmation email. Please try again.' });
  }
});

module.exports = router;
