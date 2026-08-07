-- =============================================
-- Sales soft-delete + audit trail (FIX: never hard-delete from UI)
-- Run in Supabase SQL Editor after supabase.migration.stock_restore_on_delete.sql
-- Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE)
-- =============================================

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.user_profiles (id);

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS delete_reason TEXT;

UPDATE public.sales SET is_deleted = false WHERE is_deleted IS NULL;

CREATE INDEX IF NOT EXISTS idx_sales_is_deleted ON public.sales (is_deleted);
CREATE INDEX IF NOT EXISTS idx_sales_active_invoice_date
  ON public.sales (invoice_date)
  WHERE is_deleted = false;

COMMENT ON COLUMN public.sales.is_deleted IS 'true = removed from active lists; row kept for audit';
COMMENT ON COLUMN public.sales.deleted_at IS 'When the invoice was soft-deleted';
COMMENT ON COLUMN public.sales.deleted_by IS 'user_profiles.id of the user who deleted the invoice';
COMMENT ON COLUMN public.sales.delete_reason IS 'Reason selected or entered at deletion time';

-- Restore stock + party balance only. Does NOT delete or update the sales row.
CREATE OR REPLACE FUNCTION public.restore_sale_stock_for_delete(p_sale_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_party_id BIGINT;
  v_total NUMERIC(12, 2);
  v_is_deleted BOOLEAN;
  v_item RECORD;
  v_restored JSONB := '[]'::JSONB;
  v_skipped JSONB := '[]'::JSONB;
BEGIN
  SELECT party_id, total_amount, COALESCE(is_deleted, false)
  INTO v_party_id, v_total, v_is_deleted
  FROM public.sales
  WHERE id = p_sale_id;

  IF NOT FOUND OR v_is_deleted THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  FOR v_item IN
    SELECT
      si.product_id,
      si.quantity,
      p.name AS product_name
    FROM public.sale_items si
    LEFT JOIN public.products p ON p.id = si.product_id
    WHERE si.sale_id = p_sale_id
  LOOP
    IF v_item.product_name IS NULL THEN
      v_skipped := v_skipped || jsonb_build_object(
        'product_id', v_item.product_id,
        'quantity', v_item.quantity,
        'reason', 'product_not_found'
      );
      CONTINUE;
    END IF;

    UPDATE public.products
    SET stock_quantity = stock_quantity + v_item.quantity
    WHERE id = v_item.product_id;

    v_restored := v_restored || jsonb_build_object(
      'product_id', v_item.product_id,
      'product_name', v_item.product_name,
      'quantity', v_item.quantity
    );
  END LOOP;

  UPDATE public.parties
  SET balance = balance - v_total
  WHERE id = v_party_id;

  RETURN jsonb_build_object('restored', v_restored, 'skipped', v_skipped);
END;
$$;

-- UI delete path: restore stock + UPDATE sales row. NEVER deletes sales or sale_items.
CREATE OR REPLACE FUNCTION public.soft_delete_sale(
  p_sale_id BIGINT,
  p_deleted_by UUID,
  p_delete_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock JSONB;
  v_reason TEXT;
  v_updated_id BIGINT;
BEGIN
  IF p_deleted_by IS NULL THEN
    RAISE EXCEPTION 'deleted_by is required';
  END IF;

  v_reason := NULLIF(TRIM(COALESCE(p_delete_reason, '')), '');
  IF v_reason IS NULL OR LENGTH(v_reason) < 3 THEN
    RAISE EXCEPTION 'Delete reason is required';
  END IF;

  v_stock := public.restore_sale_stock_for_delete(p_sale_id);

  UPDATE public.sales
  SET
    is_deleted = true,
    deleted_at = NOW(),
    deleted_by = p_deleted_by,
    delete_reason = v_reason
  WHERE id = p_sale_id
    AND COALESCE(is_deleted, false) = false
  RETURNING id INTO v_updated_id;

  IF v_updated_id IS NULL THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  RETURN v_stock || jsonb_build_object('soft_deleted', true, 'sale_id', v_updated_id);
END;
$$;

-- Failed create rollback only: restore stock then hard-delete (CASCADE removes sale_items).
CREATE OR REPLACE FUNCTION public.hard_delete_sale(p_sale_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock JSONB;
BEGIN
  v_stock := public.restore_sale_stock_for_delete(p_sale_id);
  DELETE FROM public.sales WHERE id = p_sale_id;
  RETURN v_stock || jsonb_build_object('soft_deleted', false, 'hard_deleted', true);
END;
$$;

-- Legacy name used by older migrations — redirect to hard delete for rollback callers only.
DROP FUNCTION IF EXISTS public.delete_sale(BIGINT);
DROP FUNCTION IF EXISTS public.delete_sale(BIGINT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.delete_sale(p_sale_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.hard_delete_sale(p_sale_id);
END;
$$;

-- Block edits to soft-deleted invoices
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
  v_is_deleted BOOLEAN;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

  SELECT party_id, total_amount, COALESCE(is_deleted, false)
  INTO v_old_party_id, v_old_total, v_is_deleted
  FROM sales
  WHERE id = p_sale_id;

  IF NOT FOUND OR v_is_deleted THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  FOR v_old_item IN
    SELECT si.product_id, si.quantity
    FROM sale_items si
    WHERE si.sale_id = p_sale_id
  LOOP
    IF EXISTS (SELECT 1 FROM products WHERE id = v_old_item.product_id) THEN
      UPDATE products
      SET stock_quantity = stock_quantity + v_old_item.quantity
      WHERE id = v_old_item.product_id;
    END IF;
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

GRANT EXECUTE ON FUNCTION public.restore_sale_stock_for_delete(BIGINT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.soft_delete_sale(BIGINT, UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.hard_delete_sale(BIGINT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_sale(BIGINT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_sale(BIGINT, BIGINT, DATE, NUMERIC, JSONB, JSONB) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
