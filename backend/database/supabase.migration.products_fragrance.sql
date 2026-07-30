-- =============================================
-- Products: fragrance (run in Supabase SQL Editor)
-- =============================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS fragrance TEXT NOT NULL DEFAULT 'Unscented';

COMMENT ON COLUMN public.products.fragrance IS 'Product scent / fragrance label';
