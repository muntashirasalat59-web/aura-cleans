-- =============================================
-- Products table: complete column alignment
-- Run ONCE in Supabase → SQL Editor
--
-- Fixes errors like:
--   "Could not find the 'cost_price' column of 'products' in the schema cache"
--
-- Safe to re-run: every change uses IF NOT EXISTS / idempotent checks.
-- After running, PostgREST schema cache is reloaded at the end.
-- =============================================

-- Bootstrap table if an older/minimal schema was used
CREATE TABLE IF NOT EXISTS public.products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Core / extended columns expected by the app (backend/routes/products.js)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS supplier TEXT NOT NULL DEFAULT '';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS unit_type TEXT NOT NULL DEFAULT 'Piece';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS unit_size NUMERIC(12, 2) NOT NULL DEFAULT 1;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku TEXT;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS fragrance TEXT NOT NULL DEFAULT 'Unscented';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS hsn_sac TEXT NOT NULL DEFAULT '';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill NULLs on columns that may pre-date NOT NULL defaults
UPDATE public.products SET price = 0 WHERE price IS NULL;
UPDATE public.products SET cost_price = 0 WHERE cost_price IS NULL;
UPDATE public.products SET stock_quantity = 0 WHERE stock_quantity IS NULL;
UPDATE public.products SET supplier = '' WHERE supplier IS NULL;
UPDATE public.products SET unit_type = 'Piece' WHERE unit_type IS NULL OR unit_type = '';
UPDATE public.products SET unit_size = 1 WHERE unit_size IS NULL;
UPDATE public.products SET description = '' WHERE description IS NULL;
UPDATE public.products SET fragrance = 'Unscented' WHERE fragrance IS NULL OR fragrance = '';
UPDATE public.products SET hsn_sac = '' WHERE hsn_sac IS NULL;
UPDATE public.products SET created_at = NOW() WHERE created_at IS NULL;

-- Legacy alias: some older scripts used hsn_code — copy into hsn_sac if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'hsn_code'
  ) THEN
    EXECUTE $sql$
      UPDATE public.products
      SET hsn_sac = COALESCE(NULLIF(TRIM(hsn_sac), ''), NULLIF(TRIM(hsn_code), ''), '')
      WHERE hsn_code IS NOT NULL
    $sql$;
  END IF;
END $$;

-- unit_type allowed values (matches frontend + backend)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_unit_type_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_unit_type_check
      CHECK (unit_type IN ('ML', 'L', 'KG', 'Gram', 'Piece', 'Box', 'Dozen'));
  END IF;
END $$;

-- Unique SKU when provided
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_unique
  ON public.products (sku)
  WHERE sku IS NOT NULL AND sku <> '';

-- Column documentation
COMMENT ON COLUMN public.products.price IS 'Selling price (MRP / retail)';
COMMENT ON COLUMN public.products.cost_price IS 'Manufacturing or purchase cost per unit';
COMMENT ON COLUMN public.products.supplier IS 'Primary supplier / vendor name';
COMMENT ON COLUMN public.products.unit_type IS 'Pack unit: ML, L, KG, Gram, Piece, Box, Dozen';
COMMENT ON COLUMN public.products.unit_size IS 'Numeric pack size (e.g. 500 for 500 ML)';
COMMENT ON COLUMN public.products.sku IS 'Stock keeping unit / internal product code';
COMMENT ON COLUMN public.products.description IS 'Optional product notes';
COMMENT ON COLUMN public.products.fragrance IS 'Product scent / fragrance label';
COMMENT ON COLUMN public.products.hsn_sac IS 'HSN or SAC code for GST invoices';

-- Reload PostgREST schema cache so Supabase API sees new columns immediately
NOTIFY pgrst, 'reload schema';
