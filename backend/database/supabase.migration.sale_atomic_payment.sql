-- =============================================
-- Atomic sale payment + safe delete_sale rollback
-- Run in Supabase SQL Editor after supabase.migration.sales_payment.sql
-- =============================================

CREATE OR REPLACE FUNCTION public.apply_sale_payment_from_json(p_sale_id BIGINT, p_payment JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_payment IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.sales
  SET
    payment_bank_name = NULLIF(trim(p_payment->>'payment_bank_name'), ''),
    payment_account_number = NULLIF(trim(p_payment->>'payment_account_number'), ''),
    payment_upi = NULLIF(trim(p_payment->>'payment_upi'), ''),
    payment_terms = NULLIF(trim(p_payment->>'payment_terms'), ''),
    payment_due_date = CASE
      WHEN NULLIF(trim(p_payment->>'payment_due_date'), '') IS NULL THEN NULL
      ELSE (p_payment->>'payment_due_date')::DATE
    END
  WHERE id = p_sale_id;
END;
$$;

-- Reverses stock + party balance, then removes the sale (sale_items CASCADE).
CREATE OR REPLACE FUNCTION public.delete_sale(p_sale_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_party_id BIGINT;
  v_total NUMERIC(12, 2);
  v_item RECORD;
BEGIN
  SELECT party_id, total_amount INTO v_party_id, v_total
  FROM public.sales
  WHERE id = p_sale_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  FOR v_item IN
    SELECT product_id, quantity FROM public.sale_items WHERE sale_id = p_sale_id
  LOOP
    UPDATE public.products
    SET stock_quantity = stock_quantity + v_item.quantity
    WHERE id = v_item.product_id;
  END LOOP;

  UPDATE public.parties
  SET balance = balance - v_total
  WHERE id = v_party_id;

  DELETE FROM public.sales WHERE id = p_sale_id;
END;
$$;

DROP FUNCTION IF EXISTS public.create_sale(BIGINT, TEXT, DATE, NUMERIC, JSONB);

CREATE OR REPLACE FUNCTION public.create_sale(
  p_party_id BIGINT,
  p_invoice_number TEXT,
  p_invoice_date DATE,
  p_gst_percent NUMERIC,
  p_items JSONB,
  p_payment JSONB DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $create_sale$
DECLARE
  v_sale_id BIGINT;
  v_subtotal NUMERIC(12, 2) := 0;
  v_gst_amount NUMERIC(12, 2);
  v_total NUMERIC(12, 2);
  v_item JSONB;
  v_product_id BIGINT;
  v_qty INTEGER;
  v_rate NUMERIC(12, 2);
  v_amount NUMERIC(12, 2);
  v_stock INTEGER;
  v_product_name TEXT;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item ->> 'product_id')::BIGINT;
    v_qty := (v_item ->> 'quantity')::INTEGER;
    v_rate := (v_item ->> 'rate')::NUMERIC;
    v_subtotal := v_subtotal + (v_qty * v_rate);

    SELECT stock_quantity, name INTO v_stock, v_product_name
    FROM products
    WHERE id = v_product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product ID % not found', v_product_id;
    END IF;

    IF v_stock < v_qty THEN
      RAISE EXCEPTION 'Not enough stock for %. Available: %', v_product_name, v_stock;
    END IF;
  END LOOP;

  v_gst_amount := (v_subtotal * COALESCE(p_gst_percent, 18)) / 100;
  v_total := v_subtotal + v_gst_amount;

  INSERT INTO sales (
    party_id,
    invoice_number,
    invoice_date,
    subtotal,
    gst_percent,
    gst_amount,
    total_amount
  )
  VALUES (
    p_party_id,
    p_invoice_number,
    p_invoice_date,
    v_subtotal,
    COALESCE(p_gst_percent, 18),
    v_gst_amount,
    v_total
  )
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item ->> 'product_id')::BIGINT;
    v_qty := (v_item ->> 'quantity')::INTEGER;
    v_rate := (v_item ->> 'rate')::NUMERIC;
    v_amount := v_qty * v_rate;

    INSERT INTO sale_items (sale_id, product_id, quantity, rate, amount)
    VALUES (v_sale_id, v_product_id, v_qty, v_rate, v_amount);

    UPDATE products
    SET stock_quantity = stock_quantity - v_qty
    WHERE id = v_product_id;
  END LOOP;

  UPDATE parties
  SET balance = balance + v_total
  WHERE id = p_party_id;

  PERFORM public.apply_sale_payment_from_json(v_sale_id, p_payment);

  RETURN v_sale_id;
END;
$create_sale$;

DROP FUNCTION IF EXISTS public.update_sale(BIGINT, BIGINT, DATE, NUMERIC, JSONB);

CREATE OR REPLACE FUNCTION public.update_sale(
  p_sale_id BIGINT,
  p_party_id BIGINT,
  p_invoice_date DATE,
  p_gst_percent NUMERIC,
  p_items JSONB,
  p_payment JSONB DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $update_sale$
DECLARE
  v_old_party_id BIGINT;
  v_old_total NUMERIC(12, 2);
  v_old_item RECORD;
  v_subtotal NUMERIC(12, 2) := 0;
  v_gst_amount NUMERIC(12, 2);
  v_total NUMERIC(12, 2);
  v_item JSONB;
  v_product_id BIGINT;
  v_qty INTEGER;
  v_rate NUMERIC(12, 2);
  v_amount NUMERIC(12, 2);
  v_stock INTEGER;
  v_product_name TEXT;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

  SELECT party_id, total_amount INTO v_old_party_id, v_old_total
  FROM sales
  WHERE id = p_sale_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  FOR v_old_item IN
    SELECT product_id, quantity FROM sale_items WHERE sale_id = p_sale_id
  LOOP
    UPDATE products
    SET stock_quantity = stock_quantity + v_old_item.quantity
    WHERE id = v_old_item.product_id;
  END LOOP;

  UPDATE parties
  SET balance = balance - v_old_total
  WHERE id = v_old_party_id;

  DELETE FROM sale_items WHERE sale_id = p_sale_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item ->> 'product_id')::BIGINT;
    v_qty := (v_item ->> 'quantity')::INTEGER;
    v_rate := (v_item ->> 'rate')::NUMERIC;
    v_subtotal := v_subtotal + (v_qty * v_rate);

    SELECT stock_quantity, name INTO v_stock, v_product_name
    FROM products
    WHERE id = v_product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product ID % not found', v_product_id;
    END IF;

    IF v_stock < v_qty THEN
      RAISE EXCEPTION 'Not enough stock for %. Available: %', v_product_name, v_stock;
    END IF;
  END LOOP;

  v_gst_amount := (v_subtotal * COALESCE(p_gst_percent, 18)) / 100;
  v_total := v_subtotal + v_gst_amount;

  UPDATE sales
  SET
    party_id = p_party_id,
    invoice_date = p_invoice_date,
    subtotal = v_subtotal,
    gst_percent = COALESCE(p_gst_percent, 18),
    gst_amount = v_gst_amount,
    total_amount = v_total
  WHERE id = p_sale_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item ->> 'product_id')::BIGINT;
    v_qty := (v_item ->> 'quantity')::INTEGER;
    v_rate := (v_item ->> 'rate')::NUMERIC;
    v_amount := v_qty * v_rate;

    INSERT INTO sale_items (sale_id, product_id, quantity, rate, amount)
    VALUES (p_sale_id, v_product_id, v_qty, v_rate, v_amount);

    UPDATE products
    SET stock_quantity = stock_quantity - v_qty
    WHERE id = v_product_id;
  END LOOP;

  UPDATE parties
  SET balance = balance + v_total
  WHERE id = p_party_id;

  PERFORM public.apply_sale_payment_from_json(p_sale_id, p_payment);

  RETURN p_sale_id;
END;
$update_sale$;

GRANT EXECUTE ON FUNCTION public.apply_sale_payment_from_json(BIGINT, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_sale(BIGINT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_sale(BIGINT, TEXT, DATE, NUMERIC, JSONB, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_sale(BIGINT, BIGINT, DATE, NUMERIC, JSONB, JSONB) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
