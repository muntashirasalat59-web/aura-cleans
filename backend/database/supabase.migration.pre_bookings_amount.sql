-- Pre-bookings: per-unit rate + stored total (rate × quantity).
-- Run in Supabase SQL Editor if the pre_bookings table already exists (safe to re-run).

ALTER TABLE public.pre_bookings
  ADD COLUMN IF NOT EXISTS rate NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.pre_bookings
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.pre_bookings.rate IS
  'Per-unit price for this booking. Defaults from the product catalog; staff may negotiate.';
COMMENT ON COLUMN public.pre_bookings.total_amount IS
  'rate × quantity, stored so the list and dashboard can show order value.';

NOTIFY pgrst, 'reload schema';
