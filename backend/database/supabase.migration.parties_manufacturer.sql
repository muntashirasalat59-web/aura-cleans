-- =============================================
-- Parties: add 'manufacturer' party type
-- Run in Supabase → SQL Editor (safe to re-run)
-- =============================================

ALTER TABLE public.parties DROP CONSTRAINT IF EXISTS parties_type_check;

ALTER TABLE public.parties
  ADD CONSTRAINT parties_type_check
  CHECK (type IN ('retailer', 'wholesaler', 'manufacturer'));

COMMENT ON COLUMN public.parties.type IS 'Party role: retailer, wholesaler, or manufacturer (supplier)';

NOTIFY pgrst, 'reload schema';
