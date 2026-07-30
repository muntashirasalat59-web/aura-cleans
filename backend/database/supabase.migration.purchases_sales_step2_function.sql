-- =============================================
-- STEP 2 of 2 — Run AFTER step 1 succeeds
-- Creates create_purchase function (uses $$ — Supabase-safe)
-- =============================================

DROP FUNCTION IF EXISTS public.create_purchase(BIGINT, DATE, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.create_purchase(BIGINT, DATE, TEXT, NUMERIC, JSONB);

CREATE OR REPLACE FUNCTION public.create_purchase(
  p_party_id BIGINT,
  p_purchase_date DATE,
  p_notes TEXT,
  p_gst_percent NUMERIC,
  p_items JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase_id BIGINT;
  v_subtotal NUMERIC(12, 2) := 0;
  v_gst_amount NUMERIC(12, 2);
  v_total NUMERIC(12, 2);
  v_item JSONB;
  v_product_id BIGINT;
  v_qty INTEGER;
  v_rate NUMERIC(12, 2);
  v_amount NUMERIC(12, 2);
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM parties WHERE id = p_party_id) THEN
    RAISE EXCEPTION 'Party not found';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item ->> 'quantity')::INTEGER;
    v_rate := (v_item ->> 'rate')::NUMERIC;
    v_subtotal := v_subtotal + (v_qty * v_rate);
  END LOOP;

  v_gst_amount := (v_subtotal * COALESCE(p_gst_percent, 18)) / 100;
  v_total := v_subtotal + v_gst_amount;

  INSERT INTO purchases (
    party_id, purchase_date, subtotal, gst_percent, gst_amount, total_amount, notes
  ) VALUES (
    p_party_id, p_purchase_date, v_subtotal, COALESCE(p_gst_percent, 18), v_gst_amount, v_total, COALESCE(p_notes, '')
  )
  RETURNING id INTO v_purchase_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item ->> 'product_id')::BIGINT;
    v_qty := (v_item ->> 'quantity')::INTEGER;
    v_rate := (v_item ->> 'rate')::NUMERIC;
    v_amount := v_qty * v_rate;

    IF NOT EXISTS (SELECT 1 FROM products WHERE id = v_product_id) THEN
      RAISE EXCEPTION 'Product ID % not found', v_product_id;
    END IF;

    INSERT INTO purchase_items (purchase_id, product_id, quantity, rate, amount)
    VALUES (v_purchase_id, v_product_id, v_qty, v_rate, v_amount);

    UPDATE products
    SET stock_quantity = stock_quantity + v_qty, cost_price = v_rate
    WHERE id = v_product_id;
  END LOOP;

  UPDATE parties SET balance = balance - v_total WHERE id = p_party_id;

  RETURN v_purchase_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_purchase(BIGINT, DATE, TEXT, NUMERIC, JSONB)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
