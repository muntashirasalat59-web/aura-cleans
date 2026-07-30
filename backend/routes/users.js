const express = require('express');
const router = express.Router();
const { getSupabaseAdmin } = require('../database/supabaseAdmin');
const { loadAllProfiles } = require('../middleware/auth');

const ROLES = ['admin', 'staff'];

router.get('/', async (req, res) => {
  try {
    let data = await loadAllProfiles();
    if (!data) {
      const { supabase, assertNoError } = require('../database/supabase');
      const result = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role, created_at')
        .order('created_at', { ascending: false });
      assertNoError(result.error);
      data = result.data;
    } else {
      data = data.map(({ id, full_name, email, role, created_at }) => ({
        id,
        full_name,
        email,
        role,
        created_at,
      }));
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { full_name, email, password, role } = req.body;

    if (!full_name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: 'Role must be admin or staff' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const admin = getSupabaseAdmin();

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim() },
    });

    if (createError) {
      return res.status(400).json({ error: createError.message });
    }

    const userId = created.user.id;

    const { data: profile, error: profileError } = await admin
      .from('user_profiles')
      .insert({
        id: userId,
        full_name: full_name.trim(),
        email: email.trim().toLowerCase(),
        role,
      })
      .select('id, full_name, email, role, created_at')
      .single();

    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      const { assertNoError } = require('../database/supabase');
      assertNoError(profileError);
    }

    res.status(201).json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.authUser.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin.auth.admin.deleteUser(id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
