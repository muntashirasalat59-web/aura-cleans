-- Pre-bookings clean rebuild. Run once in Supabase SQL Editor (entire file).
-- Drops leftover single-product header columns (product_id, quantity, …)
-- and recreates header + line items + atomic create_pre_booking().

DROP FUNCTION IF EXISTS public.create_pre_booking(TEXT, BIGINT, DATE, TEXT, JSONB);

DROP TABLE IF EXISTS public.pre_booking_items CASCADE;
DROP TABLE IF EXISTS public.pre_bookings CASCADE;

CREATE TABLE public.pre_bookings (
  id BIGSERIAL PRIMARY KEY,
  business_id TEXT NOT NULL,
  party_id BIGINT NOT NULL REFERENCES public.parties (id) ON DELETE CASCADE,
  delivery_date DATE NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'delivered', 'cancelled')),
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  gst_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  converted_invoice_id BIGINT REFERENCES public.sales (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.pre_bookings IS
  'Future-order reminders (header). Products live only in pre_booking_items.';

CREATE INDEX pre_bookings_business_id_idx ON public.pre_bookings (business_id);
CREATE INDEX pre_bookings_delivery_date_idx ON public.pre_bookings (delivery_date);
CREATE INDEX pre_bookings_status_idx ON public.pre_bookings (status);
CREATE INDEX pre_bookings_party_id_idx ON public.pre_bookings (party_id);
CREATE INDEX pre_bookings_converted_invoice_id_idx ON public.pre_bookings (converted_invoice_id);

ALTER TABLE public.pre_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY pre_bookings_authenticated_all
  ON public.pre_bookings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pre_bookings TO authenticated;
GRANT ALL ON public.pre_bookings TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.pre_bookings_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.pre_bookings_id_seq TO service_role;

CREATE TABLE public.pre_booking_items (
  id BIGSERIAL PRIMARY KEY,
  pre_booking_id BIGINT NOT NULL REFERENCES public.pre_bookings (id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  rate NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  gst_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (gst_percent >= 0),
  gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.pre_booking_items IS
  'Line products for a pre-booking. amount is the line total including GST.';
COMMENT ON COLUMN public.pre_bookings.subtotal IS
  'Sum of rate × qty across lines, before GST.';
COMMENT ON COLUMN public.pre_bookings.gst_total IS
  'Sum of line gst_amount.';
COMMENT ON COLUMN public.pre_bookings.total_amount IS
  'Grand total including GST (subtotal + gst_total).';
COMMENT ON COLUMN public.pre_booking_items.amount IS
  'Line total including GST (rate × qty + gst_amount).';

CREATE INDEX pre_booking_items_booking_idx ON public.pre_booking_items (pre_booking_id);
CREATE INDEX pre_booking_items_product_idx ON public.pre_booking_items (product_id);

ALTER TABLE public.pre_booking_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY pre_booking_items_authenticated_all
  ON public.pre_booking_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pre_booking_items TO authenticated;
GRANT ALL ON public.pre_booking_items TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.pre_booking_items_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.pre_booking_items_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.create_pre_booking(
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
  v_id BIGINT;
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

  INSERT INTO public.pre_bookings (
    business_id,
    party_id,
    delivery_date,
    notes,
    status,
    subtotal,
    gst_total,
    total_amount
  )
  VALUES (
    trim(p_business_id),
    p_party_id,
    p_delivery_date,
    COALESCE(p_notes, ''),
    'upcoming',
    ROUND(v_subtotal, 2),
    ROUND(v_gst_total, 2),
    ROUND(v_total, 2)
  )
  RETURNING id INTO v_id;

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
      v_id,
      v_product_id,
      v_qty,
      ROUND(v_rate, 2),
      ROUND(v_gst_percent, 2),
      v_gst_amount,
      v_amount
    );
  END LOOP;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pre_booking(TEXT, BIGINT, DATE, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_pre_booking(TEXT, BIGINT, DATE, TEXT, JSONB)
  TO authenticated, service_role;

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
      pre_booking_id, product_id, quantity, rate, gst_percent, gst_amount, amount
    )
    VALUES (
      p_id, v_product_id, v_qty, ROUND(v_rate, 2), ROUND(v_gst_percent, 2), v_gst_amount, v_amount
    );
  END LOOP;

  RETURN p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_pre_booking(BIGINT, TEXT, BIGINT, DATE, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_pre_booking(BIGINT, TEXT, BIGINT, DATE, TEXT, JSONB)
  TO authenticated, service_role;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pre_bookings;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'Realtime publication not found — skip';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pre_booking_items;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'Realtime publication not found — skip';
END $$;

NOTIFY pgrst, 'reload schema';
