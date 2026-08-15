const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getSupabaseAdmin } = require('../database/supabaseAdmin');
const { supabase } = require('../database/supabase');
const { normalizeEmail, isValidEmailFormat, confirmationRedirectTo } = require('../utils/email');
const { indianMobileError, phoneToAuthEmail, normalizeIndianMobile } = require('../utils/phone');

const DUPLICATE_PHONE = {
  error: 'An account with this phone number already exists. Sign in instead.',
  code: 'PHONE_EXISTS',
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
    const { business_name, full_name, phone, password } = req.body;

    if (!business_name?.trim() || !full_name?.trim() || !phone || !password) {
      return res.status(400).json({ error: 'Business name, name, phone and password are required' });
    }

    const phoneError = indianMobileError(phone);
    if (phoneError) {
      return res.status(400).json({ error: phoneError, code: 'INVALID_PHONE' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedPhone = normalizeIndianMobile(phone);
    const authEmail = phoneToAuthEmail(normalizedPhone);
    const admin = getSupabaseAdmin();
    const trialEndsAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

    const { data: existingPhone, error: phoneLookupError } = await admin
      .from('user_profiles')
      .select('id')
      .eq('phone', normalizedPhone)
      .maybeSingle();
    if (phoneLookupError && !/column|does not exist|schema cache/i.test(phoneLookupError.message || '')) {
      return signupFail(res, 500, phoneLookupError, 'Could not check existing account.');
    }
    if (existingPhone) {
      return res.status(409).json(DUPLICATE_PHONE);
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name.trim(),
        business_name: business_name.trim(),
        phone: normalizedPhone,
      },
    });
    if (authError) {
      if (isDuplicateAuthError(authError.message)) {
        return res.status(409).json(DUPLICATE_PHONE);
      }
      return signupFail(res, 400, authError);
    }

    const userId = authData.user.id;

    const { data: business, error: bizError } = await admin
      .from('businesses')
      .insert({
        business_name: business_name.trim(),
        owner_email: authEmail,
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

    const profileFull = {
      id: userId,
      full_name: full_name.trim(),
      email: authEmail,
      phone: normalizedPhone,
      role: 'admin',
      business_id: business.id,
      trial_ends_at: trialEndsAt,
    };

    let profileError = (await admin.from('user_profiles').insert(profileFull)).error;
    if (profileError && /column|schema cache|could not find|does not exist/i.test(profileError.message || '')) {
      console.warn('[auth] profile insert retry without new columns:', profileError.message);
      profileError = (
        await admin.from('user_profiles').insert({
          id: userId,
          full_name: full_name.trim(),
          email: authEmail,
          role: 'admin',
          business_id: business.id,
        })
      ).error;
    }

    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      await admin.from('businesses').delete().eq('id', business.id);
      return signupFail(res, 500, profileError);
    }

    res.status(201).json({
      needs_email_confirmation: false,
      phone: normalizedPhone,
      trial_ends_at: trialEndsAt,
      message: 'Account created. You can sign in with your phone number.',
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

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: confirmationRedirectTo(req) },
    });

    if (error) {
      if (/already confirmed|already been confirmed/i.test(error.message || '')) {
        return res.json({ already_confirmed: true, message: 'This email is already verified. Sign in instead.' });
      }
      if (/rate limit|only request this after/i.test(error.message || '')) {
        return res.status(429).json({ error: 'Please wait a moment before requesting another email.' });
      }
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Confirmation email sent.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Could not resend confirmation email.' });
  }
});

module.exports = router;
