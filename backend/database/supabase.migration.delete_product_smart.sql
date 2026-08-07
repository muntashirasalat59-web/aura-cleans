-- Smart product delete:
--   - Blocked if any sale_items reference the product (status: blocked_has_sales)
--   - If only purchase_items: remove those links (and empty/sole-product purchases), then delete product
--   - If no links: delete product
-- Safe to re-run (CREATE OR REPLACE)
-- Run in Supabase SQL Editor, then NOTIFY reloads PostgREST.

CREATE OR REPLACE FUNCTION public.delete_product_smart(p_product_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_name TEXT;
  v_sale_count INT := 0;
  v_purchase_item_count INT := 0;
  v_purchases_removed INT := 0;
  v_purchase RECORD;
  v_line_amount NUMERIC(12, 2);
  v_line_qty INT;
  v_has_delete_purchase BOOLEAN;
BEGIN
  SELECT name INTO v_product_name
  FROM public.products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'not_found',
      'product_id', p_product_id
    );
  END IF;

  SELECT COUNT(*)::INT INTO v_sale_count
  FROM public.sale_items
  WHERE product_id = p_product_id;

  IF v_sale_count > 0 THEN
    RETURN jsonb_build_object(
      'status', 'blocked_has_sales',
      'product_id', p_product_id,
      'product_name', v_product_name,
      'sale_items', v_sale_count
    );
  END IF;

  SELECT COUNT(*)::INT INTO v_purchase_item_count
  FROM public.purchase_items
  WHERE product_id = p_product_id;

  v_has_delete_purchase := to_regprocedure('public.delete_purchase(bigint)') IS NOT NULL;

  -- Purchases that only contain this product → full purchase delete (stock + party balance)
  FOR v_purchase IN
    SELECT p.id, p.party_id, p.total_amount
    FROM public.purchases p
    WHERE EXISTS (
      SELECT 1 FROM public.purchase_items pi
      WHERE pi.purchase_id = p.id AND pi.product_id = p_product_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.purchase_items pi
      WHERE pi.purchase_id = p.id AND pi.product_id <> p_product_id
    )
    ORDER BY p.id
  LOOP
    IF v_has_delete_purchase THEN
      PERFORM public.delete_purchase(v_purchase.id);
    ELSE
      UPDATE public.parties
      SET balance = balance + COALESCE(v_purchase.total_amount, 0)
      WHERE id = v_purchase.party_id;

      DELETE FROM public.purchases WHERE id = v_purchase.id;
    END IF;
    v_purchases_removed := v_purchases_removed + 1;
  END LOOP;

  -- Remaining mixed purchases: drop only this product's lines and adjust totals/balance
  FOR v_purchase IN
    SELECT
      p.id,
      p.party_id,
      COALESCE(SUM(pi.amount), 0)::NUMERIC(12, 2) AS line_amount,
      COALESCE(SUM(pi.quantity), 0)::INT AS line_qty
    FROM public.purchases p
    INNER JOIN public.purchase_items pi
      ON pi.purchase_id = p.id AND pi.product_id = p_product_id
    GROUP BY p.id, p.party_id
    ORDER BY p.id
  LOOP
    v_line_amount := v_purchase.line_amount;
    v_line_qty := v_purchase.line_qty;

    DELETE FROM public.purchase_items
    WHERE purchase_id = v_purchase.id
      AND product_id = p_product_id;

    UPDATE public.purchases
    SET
      subtotal = GREATEST(0, COALESCE(subtotal, 0) - v_line_amount),
      total_amount = GREATEST(0, COALESCE(total_amount, 0) - v_line_amount)
    WHERE id = v_purchase.id;

    UPDATE public.parties
    SET balance = balance + v_line_amount
    WHERE id = v_purchase.party_id;

    -- Product still exists at this point; reverse stock from those purchase lines
    UPDATE public.products
    SET stock_quantity = stock_quantity - v_line_qty
    WHERE id = p_product_id;
  END LOOP;

  DELETE FROM public.products WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'not_found',
      'product_id', p_product_id
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'deleted',
    'product_id', p_product_id,
    'product_name', v_product_name,
    'purchase_items_removed', v_purchase_item_count,
    'purchases_removed', v_purchases_removed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_product_smart(BIGINT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
