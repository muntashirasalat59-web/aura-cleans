-- =============================================
-- Soft delete: is_active on parties & products
-- Run ONCE in Supabase → SQL Editor
-- Safe to re-run (IF NOT EXISTS)
-- Employees already use status ('Active' | 'Inactive')
-- =============================================

ALTER TABLE public.parties
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

UPDATE public.parties SET is_active = true WHERE is_active IS NULL;
UPDATE public.products SET is_active = true WHERE is_active IS NULL;

CREATE INDEX IF NOT EXISTS idx_parties_is_active ON public.parties (is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products (is_active);

COMMENT ON COLUMN public.parties.is_active IS 'false = deactivated/archived; row kept for linked invoices';
COMMENT ON COLUMN public.products.is_active IS 'false = deactivated/archived; row kept for linked line items';

NOTIFY pgrst, 'reload schema';
