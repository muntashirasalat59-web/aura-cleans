-- =============================================
-- Products: HSN/SAC code (run in Supabase SQL Editor)
-- =============================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS hsn_sac TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.products.hsn_sac IS 'HSN or SAC code for GST invoices';
