-- =============================================
-- Purchases & Sales: complete column alignment
-- Run ONCE in Supabase → SQL Editor
--
-- Fixes errors like:
--   column "subtotal" of relation "purchases" does not exist
--
-- Safe to re-run: uses IF NOT EXISTS / idempotent backfills.
-- Includes latest create_purchase RPC (stock + party balance).
-- =============================================

-- ---------------------------------------------------------------------------
-- PURCHASES (code expects: subtotal, gst_percent, gst_amount, total_amount, notes)
-- Older DBs may only have: party_id, purchase_date, total_amount, notes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.purchases (
  id BIGSERIAL PRIMARY KEY,
  party_id BIGINT NOT NULL REFERENCES public.parties (id),
  purchase_date DATE NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS gst_percent NUMERIC(5, 2) NOT NULL DEFAULT 18;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill GST breakdown on legacy purchase rows
UPDATE public.purchases
SET
  subtotal = total_amount,
  gst_amount = 0,
  gst_percent = 18
WHERE total_amount > 0
  AND (subtotal IS NULL OR subtotal = 0)
  AND (gst_amount IS NULL OR gst_amount = 0);

UPDATE public.purchases SET notes = '' WHERE notes IS NULL;
UPDATE public.purchases SET created_at = NOW() WHERE created_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchases_party_id ON public.purchases (party_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON public.purchases (purchase_date);

COMMENT ON COLUMN public.purchases.subtotal IS 'Taxable amount before GST';
COMMENT ON COLUMN public.purchases.gst_percent IS 'GST rate applied to this purchase';
COMMENT ON COLUMN public.purchases.gst_amount IS 'GST amount in rupees';
COMMENT ON COLUMN public.purchases.total_amount IS 'Subtotal + GST';

-- ---------------------------------------------------------------------------
-- SALES / INVOICES (code expects: subtotal, gst_percent, gst_amount, total_amount)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sales (
  id BIGSERIAL PRIMARY KEY,
  party_id BIGINT NOT NULL REFERENCES public.parties (id),
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS gst_percent NUMERIC(5, 2) NOT NULL DEFAULT 18;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS invoice_date DATE;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill sales rows that only stored a single total
UPDATE public.sales
SET
  subtotal = total_amount,
  gst_amount = 0,
  gst_percent = 18
WHERE total_amount > 0
  AND (subtotal IS NULL OR subtotal = 0)
  AND (gst_amount IS NULL OR gst_amount = 0);

UPDATE public.sales SET created_at = NOW() WHERE created_at IS NULL;

-- Unique invoice numbers (skip if duplicates exist — fix data first if this fails)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_invoice_number_unique
  ON public.sales (invoice_number)
  WHERE invoice_number IS NOT NULL AND invoice_number <> '';

CREATE INDEX IF NOT EXISTS idx_sales_party_id ON public.sales (party_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_date ON public.sales (invoice_date);

COMMENT ON COLUMN public.sales.subtotal IS 'Taxable amount before GST';
COMMENT ON COLUMN public.sales.gst_percent IS 'GST rate on invoice';
COMMENT ON COLUMN public.sales.gst_amount IS 'Total GST amount';
COMMENT ON COLUMN public.sales.total_amount IS 'Invoice total incl. GST';

-- ---------------------------------------------------------------------------
-- LINE ITEM TABLES (ensure they exist)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.purchase_items (
  id BIGSERIAL PRIMARY KEY,
  purchase_id BIGINT NOT NULL REFERENCES public.purchases (id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES public.products (id),
  quantity INTEGER NOT NULL,
  rate NUMERIC(12, 2) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id BIGSERIAL PRIMARY KEY,
  sale_id BIGINT NOT NULL REFERENCES public.sales (id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES public.products (id),
  quantity INTEGER NOT NULL,
  rate NUMERIC(12, 2) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON public.purchase_items (product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON public.sale_items (product_id);

-- ---------------------------------------------------------------------------
-- create_purchase RPC (matches backend — GST columns + stock + party balance)
-- ---------------------------------------------------------------------------

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
    party_id,
    purchase_date,
    subtotal,
    gst_percent,
    gst_amount,
    total_amount,
    notes
  )
  VALUES (
    p_party_id,
    p_purchase_date,
    v_subtotal,
    COALESCE(p_gst_percent, 18),
    v_gst_amount,
    v_total,
    COALESCE(p_notes, '')
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
    SET
      stock_quantity = stock_quantity + v_qty,
      cost_price = v_rate
    WHERE id = v_product_id;
  END LOOP;

  UPDATE parties
  SET balance = balance - v_total
  WHERE id = p_party_id;

  RETURN v_purchase_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_purchase(BIGINT, DATE, TEXT, NUMERIC, JSONB)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
