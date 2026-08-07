const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getSupabaseAdmin } = require('../database/supabaseAdmin');

router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.authUser.id,
      email: req.authUser.email,
    },
    profile: req.profile,
  });
});

router.post('/signup', async (req, res) => {
  try {
    const { business_name, full_name, email, password } = req.body;

    if (!business_name?.trim() || !full_name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Business name, name, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const admin = getSupabaseAdmin();

    // 1. Create auth user (service-role, bypasses email confirmation)
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
    });
    if (authError) {
      if (/already registered|already exists/i.test(authError.message || '')) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }
      return res.status(400).json({ error: authError.message });
    }

    const userId = authData.user.id;

    // 2. Create business row
    const { data: business, error: bizError } = await admin
      .from('businesses')
      .insert({
        business_name: business_name.trim(),
        owner_email: email.trim(),
        status: 'active',
        subscription_amount: 999,
        payment_status: 'unpaid',
      })
      .select()
      .single();

    if (bizError) {
      await admin.auth.admin.deleteUser(userId); // rollback
      return res.status(500).json({ error: bizError.message });
    }

    // 3. Create user_profile row (this user becomes admin of their own new business)
    const { error: profileError } = await admin.from('user_profiles').insert({
      id: userId,
      full_name: full_name.trim(),
      email: email.trim(),
      role: 'admin',
      business_id: business.id,
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(userId); // rollback
      await admin.from('businesses').delete().eq('id', business.id);
      return res.status(500).json({ error: profileError.message });
    }

    res.status(201).json({
      message: 'Account created successfully. You can now sign in.',
      business_id: business.id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Signup failed' });
  }
});

module.exports = router;