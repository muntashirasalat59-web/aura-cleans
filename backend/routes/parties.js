const express = require('express');
const router = express.Router();
const { assertNoError } = require('../database/supabase');

const PARTY_TYPES = ['retailer', 'wholesaler', 'manufacturer'];
const {
  countPartyLinks,
  hasPartyLinks,
  partyDeleteBlockedMessage,
  isFkViolation,
  genericFkMessage,
} = require('../utils/recordLifecycle');
const { logActivity } = require('../utils/activityLog');

router.get('/', async (req, res) => {
  try {
    const { type, active_only, status } = req.query;
    let query = req.db.from('parties').select('*').order('name');

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
    const { data, error } = await req.db
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
    const { data, error } = await req.db
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

// Must be registered before GET /:id so "linked-records" is not treated as an id.
router.get('/:id/linked-records', async (req, res) => {
  try {
    const partyId = Number(req.params.id);
    if (!Number.isFinite(partyId)) {
      return res.status(400).json({ error: 'Invalid party id' });
    }

    const { data: party, error: partyError } = await req.db
      .from('parties')
      .select('id, name, type')
      .eq('id', partyId)
      .maybeSingle();

    assertNoError(partyError);
    if (!party) {
      return res.status(404).json({ error: 'Party not found' });
    }

    const [salesRes, purchasesRes] = await Promise.all([
      req.db
        .from('sales')
        .select('id, invoice_number, invoice_date, total_amount, is_deleted')
        .eq('party_id', partyId)
        .order('invoice_date', { ascending: false }),
      req.db
        .from('purchases')
        .select('id, purchase_date, total_amount, notes')
        .eq('party_id', partyId)
        .order('purchase_date', { ascending: false }),
    ]);

    assertNoError(salesRes.error);
    assertNoError(purchasesRes.error);

    const invoices = (salesRes.data || []).map((row) => ({
      id: row.id,
      invoice_number: row.invoice_number,
      invoice_date: row.invoice_date,
      total_amount: Number(row.total_amount) || 0,
      is_deleted: Boolean(row.is_deleted),
    }));

    const purchases = (purchasesRes.data || []).map((row) => ({
      id: row.id,
      purchase_date: row.purchase_date,
      total_amount: Number(row.total_amount) || 0,
      notes: row.notes || '',
    }));

    const totalCount = invoices.length + purchases.length;

    res.json({
      party,
      invoices,
      purchases,
      totalCount,
      counts: {
        invoices: invoices.filter((row) => !row.is_deleted).length,
        softDeletedInvoices: invoices.filter((row) => row.is_deleted).length,
        purchases: purchases.length,
        total: totalCount,
      },
    });
  } catch (error) {
    console.error('[parties.linked-records]', error);
    res.status(500).json({ error: error.message || 'Failed to load linked records' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await req.db.from('parties').select('*').eq('id', req.params.id).maybeSingle();
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

    const { data, error } = await req.db
      .from('parties')
      .insert({
        name,
        type,
        contact: contact || '',
        address: address || '',
        gst_number: gst_number || '',
        balance: balance || 0,
        is_active: true,
        business_id: req.profile.business_id,
      })
      .select()
      .single();

    assertNoError(error);
    await logActivity(req, {
      actionType: 'create',
      entityType: 'party',
      entityId: data.id,
      entityName: data.name,
      details: { type: data.type },
    });
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, type, contact, address, gst_number, balance, is_active } = req.body;
    const { id } = req.params;

    const { data: existing, error: fetchError } = await req.db
      .from('parties')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    assertNoError(fetchError);
    if (!existing) {
      return res.status(404).json({ error: 'Party not found' });
    }

    const { data, error } = await req.db
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
    await logActivity(req, {
      actionType: 'update',
      entityType: 'party',
      entityId: data.id,
      entityName: data.name,
      details: { type: data.type },
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cascade delete via Supabase RPC — must be before DELETE /:id
router.delete('/:id/cascade', async (req, res) => {
  try {
    const partyId = Number(req.params.id);
    if (!Number.isFinite(partyId)) {
      return res.status(400).json({ error: 'Invalid party id' });
    }

    const { data: existing, error: fetchError } = await req.db
      .from('parties')
      .select('id, name')
      .eq('id', partyId)
      .maybeSingle();

    assertNoError(fetchError);
    if (!existing) {
      return res.status(404).json({ error: 'Party not found' });
    }

    const { data, error } = await req.db.rpc('delete_party_cascade', {
      p_party_id: partyId,
    });

    if (error && /could not find the function|does not exist/i.test(error.message)) {
      return res.status(503).json({
        error:
          'delete_party_cascade RPC is missing. Create it in Supabase SQL Editor (see supabase.migration.delete_party_cascade.sql).',
      });
    }

    assertNoError(error);

    const result = data || {};
    const salesDeleted = Number(result.sales_deleted) || 0;
    const purchasesDeleted = Number(result.purchases_deleted) || 0;
    const partyName = result.party_name || existing.name;

    await logActivity(req, {
      actionType: 'delete',
      entityType: 'party',
      entityId: partyId,
      entityName: partyName,
      details: { cascade: true, sales_deleted: salesDeleted, purchases_deleted: purchasesDeleted },
    });

    res.json({
      success: true,
      message: `Party "${partyName}" deleted. Removed ${salesDeleted} invoice(s) and ${purchasesDeleted} purchase(s).`,
      party_id: result.party_id ?? partyId,
      party_name: partyName,
      sales_deleted: salesDeleted,
      purchases_deleted: purchasesDeleted,
      result,
    });
  } catch (error) {
    console.error('[parties.cascade]', error);
    const message = error.message || 'Failed to cascade-delete party';
    if (message.includes('Party not found')) {
      return res.status(404).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: fetchError } = await req.db
      .from('parties')
      .select('id, name')
      .eq('id', id)
      .maybeSingle();

    assertNoError(fetchError);
    if (!existing) {
      return res.status(404).json({ error: 'Party not found' });
    }

    const links = await countPartyLinks(req.db, id);
    if (hasPartyLinks(links)) {
      return res.status(409).json({
        error: partyDeleteBlockedMessage(links),
        code: 'LINKED_RECORDS',
        links,
      });
    }

    // Soft-deleted invoices still reference party_id; remove them so FK does not block.
    const { error: softSalesCleanupError } = await req.db
      .from('sales')
      .delete()
      .eq('party_id', id)
      .eq('is_deleted', true);
    assertNoError(softSalesCleanupError);

    const { data, error } = await req.db.from('parties').delete().eq('id', id).select('id');

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
    await logActivity(req, {
      actionType: 'delete',
      entityType: 'party',
      entityId: id,
      entityName: existing.name,
    });
    res.json({ success: true, message: 'Party deleted successfully' });
  } catch (error) {
    console.error('[parties.delete]', error);
    if (isFkViolation(error)) {
      return res.status(409).json({ error: genericFkMessage('party'), code: 'LINKED_RECORDS' });
    }
    res.status(500).json({ error: error.message || 'Failed to delete party' });
  }
});

module.exports = router;