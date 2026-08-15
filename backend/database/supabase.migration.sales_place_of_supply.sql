-- Invoice Place of Supply + optional shipping address.
-- Run once in Supabase → SQL Editor → Run.

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS place_of_supply TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address TEXT;

COMMENT ON COLUMN public.sales.place_of_supply IS
  'Customer state for GST Place of Supply. Empty shipping_address means same as billing.';
COMMENT ON COLUMN public.sales.shipping_address IS
  'Optional ship-to address. NULL/blank means same as billing address.';

NOTIFY pgrst, 'reload schema';
