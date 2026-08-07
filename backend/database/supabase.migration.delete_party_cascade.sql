-- =============================================
-- Cascade-delete a party with all linked sales/purchases
-- Run in Supabase SQL Editor after sales_soft_delete migration
-- Safe to re-run (CREATE OR REPLACE)
-- =============================================
-- Relations handled:
--   sales.party_id → parties.id
--   sale_items.sale_id → sales.id (ON DELETE CASCADE)
--   purchases.party_id → parties.id
--   purchase_items.purchase_id → purchases.id (ON DELETE CASCADE)
-- Payment fields live on sales row (no separate payments table).
-- =============================================

CREATE OR REPLACE FUNCTION public.delete_party_cascade(p_party_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_party_name TEXT;
  v_sale RECORD;
  v_purchase RECORD;
  v_sales_deleted INT := 0;
  v_purchases_deleted INT := 0;
BEGIN
  SELECT name INTO v_party_name
  FROM public.parties
  WHERE id = p_party_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Party not found';
  END IF;

  -- Active sales: restore stock + reverse balance, then hard-delete (sale_items cascade).
  -- Soft-deleted sales: stock/balance already restored — just remove the row.
  FOR v_sale IN
    SELECT id, COALESCE(is_deleted, false) AS is_deleted
    FROM public.sales
    WHERE party_id = p_party_id
    ORDER BY id
  LOOP
    IF v_sale.is_deleted THEN
      DELETE FROM public.sales WHERE id = v_sale.id;
    ELSE
      PERFORM public.hard_delete_sale(v_sale.id);
    END IF;
    v_sales_deleted := v_sales_deleted + 1;
  END LOOP;

  -- Purchases: reverse stock additions + party balance, then delete (purchase_items cascade).
  FOR v_purchase IN
    SELECT id
    FROM public.purchases
    WHERE party_id = p_party_id
    ORDER BY id
  LOOP
    PERFORM public.delete_purchase(v_purchase.id);
    v_purchases_deleted := v_purchases_deleted + 1;
  END LOOP;

  DELETE FROM public.parties WHERE id = p_party_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Party not found';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'party_id', p_party_id,
    'party_name', v_party_name,
    'sales_deleted', v_sales_deleted,
    'purchases_deleted', v_purchases_deleted
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_party_cascade(BIGINT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
