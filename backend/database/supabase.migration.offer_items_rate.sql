-- =============================================
-- offer_items.rate: combo-specific retail rate per line
-- Run in Supabase SQL Editor. Safe to re-run.
-- =============================================

ALTER TABLE public.offer_items
  ADD COLUMN IF NOT EXISTS rate NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (rate >= 0);

COMMENT ON COLUMN public.offer_items.rate IS
  'Retail unit rate for this product inside this combo. May differ from products.retail_price.';

NOTIFY pgrst, 'reload schema';
