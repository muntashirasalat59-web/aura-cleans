const express = require('express');
const router = express.Router();
const { getSupabaseAdmin } = require('../database/supabaseAdmin');
const { hasValidAccess } = require('../middleware/checkAccess');

function denyIfTrialActive(req, res) {
  if (req.profile?.is_platform_admin) return false;
  if (hasValidAccess(req.profile)) {
    res.status(403).json({
      error: 'Support chat is available after your trial ends.',
      code: 'TRIAL_ACTIVE',
    });
    return true;
  }
  return false;
}

router.get('/threads', async (req, res) => {
  try {
    if (!req.profile?.is_platform_admin) {
      return res.status(403).json({ error: 'Platform admin access required' });
    }

    const admin = getSupabaseAdmin();
    const { data: rows, error } = await admin
      .from('support_messages')
      .select('id, user_id, sender, message, created_at, is_read')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const byUser = new Map();
    for (const row of rows || []) {
      const current = byUser.get(row.user_id) || {
        user_id: row.user_id,
        last_message: row.message,
        last_at: row.created_at,
        unread: 0,
      };
      if (row.sender === 'customer' && !row.is_read) current.unread += 1;
      if (!current.last_at || row.created_at > current.last_at) {
        current.last_message = row.message;
        current.last_at = row.created_at;
      }
      byUser.set(row.user_id, current);
    }

    const ids = [...byUser.keys()];
    let profiles = [];
    if (ids.length) {
      const { data: profileRows, error: profileError } = await admin
        .from('user_profiles')
        .select('id, full_name, phone, email, trial_ends_at, business_id')
        .in('id', ids);
      if (profileError) return res.status(500).json({ error: profileError.message });
      profiles = profileRows || [];
    }

    const profileById = new Map(profiles.map((p) => [p.id, p]));
    const threads = ids
      .map((id) => {
        const thread = byUser.get(id);
        const profile = profileById.get(id) || {};
        return {
          ...thread,
          full_name: profile.full_name || 'Customer',
          phone: profile.phone || null,
          email: profile.email || null,
          trial_ends_at: profile.trial_ends_at || null,
        };
      })
      .sort((a, b) => {
        if (Boolean(b.unread) !== Boolean(a.unread)) return b.unread ? 1 : -1;
        return new Date(b.last_at) - new Date(a.last_at);
      });

    res.json(threads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const isAdmin = Boolean(req.profile?.is_platform_admin);
    const userId = isAdmin && req.query.user_id ? String(req.query.user_id) : req.authUser.id;

    if (!isAdmin && denyIfTrialActive(req, res)) return;

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('support_messages')
      .select('id, user_id, sender, message, created_at, is_read')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    if (isAdmin && req.query.user_id) {
      await admin
        .from('support_messages')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('sender', 'customer')
        .eq('is_read', false);
    }

    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const text = String(req.body?.message || '').trim();
    if (!text) return res.status(400).json({ error: 'Message is required' });
    if (text.length > 2000) return res.status(400).json({ error: 'Message is too long (max 2000 characters)' });

    const admin = getSupabaseAdmin();
    const isAdmin = Boolean(req.profile?.is_platform_admin);

    if (isAdmin) {
      const userId = String(req.body?.user_id || '').trim();
      if (!userId) return res.status(400).json({ error: 'user_id is required' });

      const { data, error } = await admin
        .from('support_messages')
        .insert({
          user_id: userId,
          sender: 'admin',
          message: text,
          is_read: true,
        })
        .select('id, user_id, sender, message, created_at, is_read')
        .single();

      if (error) return res.status(500).json({ error: error.message });

      await admin
        .from('support_messages')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('sender', 'customer')
        .eq('is_read', false);

      return res.status(201).json(data);
    }

    if (denyIfTrialActive(req, res)) return;

    const { data, error } = await admin
      .from('support_messages')
      .insert({
        user_id: req.authUser.id,
        sender: 'customer',
        message: text,
        is_read: false,
      })
      .select('id, user_id, sender, message, created_at, is_read')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
