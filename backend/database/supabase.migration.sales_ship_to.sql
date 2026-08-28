-- Courier destination printed on the invoice PDF (separate from City/Branch
-- tracking and from GST shipping_address).
-- Run once in Supabase → SQL Editor → Run.

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS ship_to_city TEXT,
  ADD COLUMN IF NOT EXISTS ship_to_address TEXT;

COMMENT ON COLUMN public.sales.ship_to_city IS
  'Courier destination city printed on the invoice when set (e.g. Surat). Empty means omit the SHIP TO block.';
COMMENT ON COLUMN public.sales.ship_to_address IS
  'Optional courier delivery address printed under ship_to_city.';

NOTIFY pgrst, 'reload schema';
