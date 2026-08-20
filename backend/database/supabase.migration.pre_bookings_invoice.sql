-- Pre-bookings: remember which invoice was created from a booking.
-- Supabase SQL Editor → Run (safe to re-run). Does not drop tables.

ALTER TABLE public.pre_bookings
  ADD COLUMN IF NOT EXISTS converted_invoice_id BIGINT REFERENCES public.sales (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pre_bookings_converted_invoice_id_idx
  ON public.pre_bookings (converted_invoice_id);

COMMENT ON COLUMN public.pre_bookings.converted_invoice_id IS
  'Sale created from this booking. Set only after that invoice is saved.';

NOTIFY pgrst, 'reload schema';
