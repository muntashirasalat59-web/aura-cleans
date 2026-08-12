const express = require('express');
const router = express.Router();
const { getSupabaseAdmin } = require('../database/supabaseAdmin');

const ROLES = ['admin', 'staff'];

router.get('/', async (req, res) => {
  try {
    const admin = getSupabaseAdmin();

    // Platform super-admin (AADIL) sees the list of customer accounts
    // (businesses), never anyone's actual business data or cross-business
    // staff list.
    if (req.profile?.is_platform_admin) {
      const { data, error } = await admin
        .from('businesses')
        .select('id, business_name, owner_email, status, created_at, subscription_amount, payment_status, payment_due_date')
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      const mapped = (data || []).map((biz) => ({
        id: biz.id,
        full_name: biz.business_name,
        email: biz.owner_email,
        role: biz.status,
        created_at: biz.created_at,
        subscription_amount: biz.subscription_amount,
        payment_status: biz.payment_status,
        payment_due_date: biz.payment_due_date,
      }));
      return res.json(mapped);
    }

    // Regular business user: only their own business's staff.
    const businessId = req.profile?.business_id;
    if (!businessId) {
      return res.json([]);
    }

    const { data, error } = await req.db
      .from('user_profiles')
      .select('id, full_name, email, role, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { full_name, email, password, role, business_name } = req.body;

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
    const isPlatformAdmin = Boolean(req.profile?.is_platform_admin);

    let businessId;
    let createdNewBusiness = false;

    if (isPlatformAdmin) {
      const resolvedBusinessName = business_name?.trim() || `${full_name.trim()}'s Business`;
      const { data: business, error: businessError } = await admin
        .from('businesses')
        .insert({
          business_name: resolvedBusinessName,
          owner_email: email.trim().toLowerCase(),
          status: 'active',
        })
        .select('id')
        .single();

      if (businessError) {
        return res.status(400).json({ error: `Failed to create business: ${businessError.message}` });
      }
      businessId = business.id;
      createdNewBusiness = true;
    } else {
      businessId = req.profile?.business_id;
      if (!businessId) {
        return res.status(400).json({ error: 'Your account is not linked to a business' });
      }
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim() },
    });

    if (createError) {
      if (createdNewBusiness) {
        await admin.from('businesses').delete().eq('id', businessId);
      }
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
        business_id: businessId,
      })
      .select('id, full_name, email, role, business_id, created_at')
      .single();

    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      if (createdNewBusiness) {
        await admin.from('businesses').delete().eq('id', businessId);
      }
      return res.status(400).json({ error: profileError.message });
    }

    res.status(201).json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/mark-business-paid', async (req, res) => {
  try {
    if (!req.profile?.is_platform_admin) {
      return res.status(403).json({ error: 'Only the platform admin can mark subscriptions as paid' });
    }

    const admin = getSupabaseAdmin();
    const paymentDate = String(req.body?.payment_date || '').trim() || new Date().toISOString().slice(0, 10);

    const { data, error } = await admin
      .from('businesses')
      .update({ payment_status: 'paid', payment_due_date: null })
      .eq('id', req.params.id)
      .select('id, business_name, payment_status')
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    if (!data) {
      return res.status(404).json({ error: 'Business not found' });
    }

    res.json({ ...data, message: `${data.business_name} marked as paid`, payment_date: paymentDate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const admin = getSupabaseAdmin();

    // Platform admin: `id` is a business.id — delete the business and its owner auth user
    if (req.profile?.is_platform_admin) {
      const { data: business, error: bizError } = await admin
        .from('businesses')
        .select('id, business_name, owner_email')
        .eq('id', id)
        .maybeSingle();

      if (bizError) return res.status(400).json({ error: bizError.message });
      if (!business) return res.status(404).json({ error: 'Business not found' });

      // Find auth user by owner_email
      const { data: authList, error: authListError } = await admin.auth.admin.listUsers({ perPage: 1000 });
      if (authListError) return res.status(400).json({ error: authListError.message });

      const ownerAuthUser = authList.users.find(
        (u) => u.email?.toLowerCase() === business.owner_email?.toLowerCase()
      );

      // Prevent self-delete
      if (ownerAuthUser && ownerAuthUser.id === req.authUser.id) {
        return res.status(400).json({ error: 'You cannot delete your own account' });
      }

      // Delete all user_profiles linked to this business first (removes FK constraint)
      await admin.from('user_profiles').delete().eq('business_id', id);

      // Delete the business row
      const { error: delBizError } = await admin.from('businesses').delete().eq('id', id);
      if (delBizError) return res.status(400).json({ error: delBizError.message });

      // Delete auth user if found
      if (ownerAuthUser) {
        await admin.auth.admin.deleteUser(ownerAuthUser.id);
      }

      return res.json({ message: `Business "${business.business_name}" and its owner deleted successfully` });
    }

    // Regular admin: `id` is a user_profiles.id (auth user UUID)
    if (id === req.authUser.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const { data: target, error: targetError } = await admin
      .from('user_profiles')
      .select('id, business_id')
      .eq('id', id)
      .maybeSingle();

    if (targetError) return res.status(400).json({ error: targetError.message });
    if (!target || target.business_id !== req.profile?.business_id) {
      return res.status(403).json({ error: 'You can only remove users from your own business' });
    }

    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;