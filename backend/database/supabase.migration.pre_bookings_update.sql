-- Additive: atomic update for upcoming pre-bookings.
-- Supabase SQL Editor → Run (safe to re-run). Does not drop tables.

DROP FUNCTION IF EXISTS public.update_pre_booking(BIGINT, TEXT, BIGINT, DATE, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.update_pre_booking(
  p_id BIGINT,
  p_business_id TEXT,
  p_party_id BIGINT,
  p_delivery_date DATE,
  p_notes TEXT,
  p_items JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_business_id TEXT;
  v_item JSONB;
  v_product_id BIGINT;
  v_qty NUMERIC(12, 2);
  v_rate NUMERIC(12, 2);
  v_gst_percent NUMERIC(5, 2);
  v_taxable NUMERIC(12, 2);
  v_gst_amount NUMERIC(12, 2);
  v_amount NUMERIC(12, 2);
  v_subtotal NUMERIC(12, 2) := 0;
  v_gst_total NUMERIC(12, 2) := 0;
  v_total NUMERIC(12, 2) := 0;
BEGIN
  IF p_id IS NULL OR p_id <= 0 THEN
    RAISE EXCEPTION 'Pre-booking not found';
  END IF;
  IF p_business_id IS NULL OR length(trim(p_business_id)) = 0 THEN
    RAISE EXCEPTION 'Business is required';
  END IF;
  IF p_party_id IS NULL OR p_party_id <= 0 THEN
    RAISE EXCEPTION 'Party is required';
  END IF;
  IF p_delivery_date IS NULL THEN
    RAISE EXCEPTION 'Delivery date is required';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Add at least one product';
  END IF;

  SELECT status, business_id INTO v_status, v_business_id
  FROM public.pre_bookings
  WHERE id = p_id;

  IF NOT FOUND OR v_business_id IS DISTINCT FROM trim(p_business_id) THEN
    RAISE EXCEPTION 'Pre-booking not found';
  END IF;
  IF v_status IS DISTINCT FROM 'upcoming' THEN
    RAISE EXCEPTION 'Only upcoming pre-bookings can be edited';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(v_item ->> 'product_id', '')::BIGINT;
    v_qty := COALESCE(NULLIF(v_item ->> 'quantity', '')::NUMERIC, 0);
    v_rate := COALESCE(NULLIF(v_item ->> 'rate', '')::NUMERIC, 0);
    IF v_item ->> 'gst_percent' IS NULL OR v_item ->> 'gst_percent' = '' THEN
      v_gst_percent := 18;
    ELSE
      v_gst_percent := COALESCE((v_item ->> 'gst_percent')::NUMERIC, 0);
    END IF;

    IF v_product_id IS NULL OR v_product_id <= 0 THEN
      RAISE EXCEPTION 'Each row needs a product';
    END IF;
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Each product needs a quantity greater than 0';
    END IF;
    IF v_rate < 0 THEN
      RAISE EXCEPTION 'Each product needs a rate';
    END IF;
    IF v_gst_percent < 0 THEN
      RAISE EXCEPTION 'GST percent cannot be negative';
    END IF;

    v_taxable := ROUND(v_qty * v_rate, 2);
    v_gst_amount := ROUND(v_taxable * v_gst_percent / 100, 2);
    v_amount := ROUND(v_taxable + v_gst_amount, 2);
    v_subtotal := v_subtotal + v_taxable;
    v_gst_total := v_gst_total + v_gst_amount;
    v_total := v_total + v_amount;
  END LOOP;

  UPDATE public.pre_bookings
  SET
    party_id = p_party_id,
    delivery_date = p_delivery_date,
    notes = COALESCE(p_notes, ''),
    subtotal = ROUND(v_subtotal, 2),
    gst_total = ROUND(v_gst_total, 2),
    total_amount = ROUND(v_total, 2)
  WHERE id = p_id;

  DELETE FROM public.pre_booking_items WHERE pre_booking_id = p_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item ->> 'product_id')::BIGINT;
    v_qty := (v_item ->> 'quantity')::NUMERIC;
    v_rate := COALESCE((v_item ->> 'rate')::NUMERIC, 0);
    IF v_item ->> 'gst_percent' IS NULL OR v_item ->> 'gst_percent' = '' THEN
      v_gst_percent := 18;
    ELSE
      v_gst_percent := COALESCE((v_item ->> 'gst_percent')::NUMERIC, 0);
    END IF;
    v_taxable := ROUND(v_qty * v_rate, 2);
    v_gst_amount := ROUND(v_taxable * v_gst_percent / 100, 2);
    v_amount := ROUND(v_taxable + v_gst_amount, 2);

    INSERT INTO public.pre_booking_items (
      pre_booking_id,
      product_id,
      quantity,
      rate,
      gst_percent,
      gst_amount,
      amount
    )
    VALUES (
      p_id,
      v_product_id,
      v_qty,
      ROUND(v_rate, 2),
      ROUND(v_gst_percent, 2),
      v_gst_amount,
      v_amount
    );
  END LOOP;

  RETURN p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_pre_booking(BIGINT, TEXT, BIGINT, DATE, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_pre_booking(BIGINT, TEXT, BIGINT, DATE, TEXT, JSONB)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
