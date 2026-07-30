const express = require('express');
const router = express.Router();
const { supabase, assertNoError } = require('../database/supabase');

const PARTY_TYPES = ['retailer', 'wholesaler', 'manufacturer'];
const {
  countPartyLinks,
  hasPartyLinks,
  partyDeleteBlockedMessage,
  isFkViolation,
  genericFkMessage,
} = require('../utils/recordLifecycle');

router.get('/', async (req, res) => {
  try {
    const { type, active_only, status } = req.query;
    let query = supabase.from('parties').select('*').order('name');

    if (type) {
      query = query.eq('type', type);
    }
    if (active_only === 'true' || status === 'active') {
      query = query.or('is_active.is.null,is_active.eq.true');
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    const { data, error } = await query;
    assertNoError(error);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('parties')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .maybeSingle();

    assertNoError(error);
    if (!data) {
      return res.status(404).json({ error: 'Party not found' });
    }
    res.json({ message: 'Party deactivated successfully', party: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/reactivate', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('parties')
      .update({ is_active: true })
      .eq('id', id)
      .select()
      .maybeSingle();

    assertNoError(error);
    if (!data) {
      return res.status(404).json({ error: 'Party not found' });
    }
    res.json({ message: 'Party reactivated successfully', party: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('parties').select('*').eq('id', req.params.id).maybeSingle();
    assertNoError(error);
    if (!data) {
      return res.status(404).json({ error: 'Party not found' });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, type, contact, address, gst_number, balance } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    if (!PARTY_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Type must be retailer, wholesaler, or manufacturer' });
    }

    const { data, error } = await supabase
      .from('parties')
      .insert({
        name,
        type,
        contact: contact || '',
        address: address || '',
        gst_number: gst_number || '',
        balance: balance || 0,
        is_active: true,
      })
      .select()
      .single();

    assertNoError(error);
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, type, contact, address, gst_number, balance, is_active } = req.body;
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabase
      .from('parties')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    assertNoError(fetchError);
    if (!existing) {
      return res.status(404).json({ error: 'Party not found' });
    }

    const { data, error } = await supabase
      .from('parties')
      .update({
        name: name ?? existing.name,
        type: type ?? existing.type,
        contact: contact ?? existing.contact,
        address: address ?? existing.address,
        gst_number: gst_number ?? existing.gst_number,
        balance: balance ?? existing.balance,
        ...(is_active !== undefined ? { is_active: Boolean(is_active) } : {}),
      })
      .eq('id', id)
      .select()
      .single();

    assertNoError(error);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabase
      .from('parties')
      .select('id, name')
      .eq('id', id)
      .maybeSingle();

    assertNoError(fetchError);
    if (!existing) {
      return res.status(404).json({ error: 'Party not found' });
    }

    const links = await countPartyLinks(supabase, id);
    if (hasPartyLinks(links)) {
      return res.status(409).json({
        error: partyDeleteBlockedMessage(links),
        code: 'LINKED_RECORDS',
        links,
      });
    }

    const { data, error } = await supabase.from('parties').delete().eq('id', id).select('id');

    if (error) {
      if (isFkViolation(error)) {
        return res.status(409).json({
          error: partyDeleteBlockedMessage(links) || genericFkMessage('party'),
          code: 'LINKED_RECORDS',
        });
      }
      assertNoError(error);
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Party not found' });
    }
    res.json({ message: 'Party deleted successfully' });
  } catch (error) {
    if (isFkViolation(error)) {
      return res.status(409).json({ error: genericFkMessage('party'), code: 'LINKED_RECORDS' });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
