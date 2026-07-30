-- =============================================
-- Migration: extended product fields
-- Run in Supabase SQL Editor (after base schema)
-- Safe to re-run: uses IF NOT EXISTS
-- =============================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS supplier TEXT NOT NULL DEFAULT '';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS unit_type TEXT NOT NULL DEFAULT 'Piece';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS unit_size NUMERIC(12, 2) NOT NULL DEFAULT 1;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku TEXT;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.products.price IS 'Selling price (MRP / retail)';
COMMENT ON COLUMN public.products.cost_price IS 'Manufacturing or purchase cost per unit';

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_unique
  ON public.products (sku)
  WHERE sku IS NOT NULL AND sku <> '';
