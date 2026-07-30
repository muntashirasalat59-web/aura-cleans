const express = require('express');
const router = express.Router();
const { supabase, assertNoError } = require('../database/supabase');
const { resolvePurchaseLineItems } = require('../utils/purchaseItems');
function mapPurchaseRow(row) {
  const party = row.parties;
  const { parties, ...rest } = row;
  return {
    ...rest,
    party_name: party?.name,
    party_type: party?.type,
  };
}

async function fetchPurchaseWithItems(purchaseId) {
  const { data: purchase, error: purchaseError } = await supabase
    .from('purchases')
    .select('*, parties(name)')
    .eq('id', purchaseId)
    .single();

  assertNoError(purchaseError);

  const { data: items, error: itemsError } = await supabase
    .from('purchase_items')
    .select('*, products(name)')
    .eq('purchase_id', purchaseId);

  assertNoError(itemsError);

  const mapped = mapPurchaseRow(purchase);
  mapped.items = (items || []).map((row) => ({
    ...row,
    product_name: row.products?.name,
    products: undefined,
  }));

  return mapped;
}

router.get('/', async (req, res) => {
  try {
    const { party_id } = req.query;
    let query = supabase
      .from('purchases')
      .select('*, parties(name, type)')
      .order('purchase_date', { ascending: false });

    if (party_id) {
      query = query.eq('party_id', party_id);
    }

    const { data, error } = await query;
    assertNoError(error);
    res.json((data || []).map(mapPurchaseRow));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get('/:id', async (req, res) => {
  try {
    const purchase = await fetchPurchaseWithItems(req.params.id);
    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }
    res.json(purchase);
  } catch (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Purchase not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { party_id, purchase_date, notes, items } = req.body;

    if (!party_id || !purchase_date || !items || items.length === 0) {
      return res.status(400).json({ error: 'Party, date and items are required' });
    }

    const { data: party, error: partyError } = await supabase
      .from('parties')
      .select('name')
      .eq('id', party_id)
      .maybeSingle();

    assertNoError(partyError);
    if (!party) {
      return res.status(400).json({ error: 'Party not found' });
    }

    const resolvedItems = await resolvePurchaseLineItems(supabase, items, {
      supplierName: party.name,
    });

    const { data: purchaseId, error } = await supabase.rpc('create_purchase', {
      p_party_id: party_id,
      p_purchase_date: purchase_date,
      p_notes: notes || '',
      p_gst_percent: req.body.gst_percent ?? 18,
      p_items: resolvedItems,
    });

    assertNoError(error);

    const purchase = await fetchPurchaseWithItems(purchaseId);
    res.status(201).json(purchase);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to save purchase' });
  }
});
module.exports = router;
