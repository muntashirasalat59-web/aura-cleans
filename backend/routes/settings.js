const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const {
  fetchBusinessSettings,
  upsertBusinessSettings,
} = require('../utils/businessSettings');
const { logActivity } = require('../utils/activityLog');
const { getSupabaseAdmin } = require('../database/supabaseAdmin');

const router = express.Router();

const BUCKET = 'business-assets';
const ALLOWED_TYPES = ['logo', 'signature', 'stamp'];
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

/** GET /api/settings/business — letterhead for invoices (all authenticated roles). */
router.get('/business', async (req, res) => {
  try {
    const settings = await fetchBusinessSettings(req.accessToken, req.profile?.business_id);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load business settings' });
  }
});

/** PUT /api/settings/business — admin only. */
router.put('/business', requireAdmin, async (req, res) => {
  try {
    const settings = await upsertBusinessSettings(
      req.body || {},
      req.accessToken,
      req.profile?.business_id
    );
    await logActivity(req, {
      actionType: 'update',
      entityType: 'settings',
      entityId: req.profile?.business_id || '1',
      entityName: settings?.company_name || 'Business settings',
      details: { fields_updated: Object.keys(req.body || {}) },
    });
    res.json(settings);
  } catch (error) {
    const status = error.code === 'SETTINGS_TABLE_MISSING' || error.code === 'NO_BUSINESS' ? 503 : 500;
    res.status(status).json({ error: error.message || 'Failed to save business settings' });
  }
});

/**
 * POST /api/settings/business/upload-image — admin only.
 * Body: { type: 'logo' | 'signature' | 'stamp', data: 'data:image/png;base64,....' }
 * Returns: { url }
 */
router.post('/business/upload-image', requireAdmin, async (req, res) => {
  try {
    const businessId = req.profile?.business_id;
    if (!businessId) {
      return res.status(400).json({ error: 'Your account is not linked to a business' });
    }

    const { type, data } = req.body || {};
    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${ALLOWED_TYPES.join(', ')}` });
    }
    if (!data || typeof data !== 'string' || !data.startsWith('data:image/')) {
      return res.status(400).json({ error: 'data must be a base64 image data URL' });
    }

    const match = data.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: 'Only PNG, JPEG, or WEBP images are supported' });
    }

    const ext = match[1] === 'jpg' ? 'jpeg' : match[1];
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > MAX_BYTES) {
      return res.status(400).json({ error: 'Image must be under 2MB' });
    }

    const admin = getSupabaseAdmin();
    const filePath = `${businessId}/${type}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: `image/${ext}`,
        upsert: true,
      });

    if (uploadError) {
      return res.status(500).json({ error: `Upload failed: ${uploadError.message}` });
    }

    const { data: publicUrlData } = admin.storage.from(BUCKET).getPublicUrl(filePath);
    const url = `${publicUrlData.publicUrl}?v=${Date.now()}`; // cache-bust

    res.json({ url, type });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to upload image' });
  }
});

module.exports = router;