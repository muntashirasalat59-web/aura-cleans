-- Pre-bookings GST, matching sales: line amount is excl. GST; header stores
-- subtotal, gst_total, and total_amount (subtotal + GST).
-- Supabase SQL Editor → Run (safe to re-run).

ALTER TABLE public.pre_bookings
  ADD COLUMN IF NOT EXISTS gst_percent NUMERIC(5, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.pre_bookings
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.pre_bookings
  ADD COLUMN IF NOT EXISTS gst_total NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.pre_booking_items
  ADD COLUMN IF NOT EXISTS gst_percent NUMERIC(5, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.pre_booking_items
  ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.pre_bookings.subtotal IS
  'Sum of line amounts (rate × qty), before GST.';
COMMENT ON COLUMN public.pre_bookings.gst_total IS
  'GST on the booking subtotal at gst_percent.';
COMMENT ON COLUMN public.pre_bookings.total_amount IS
  'Grand total including GST (subtotal + gst_total).';
COMMENT ON COLUMN public.pre_booking_items.amount IS
  'Line amount excluding GST (rate × quantity).';
COMMENT ON COLUMN public.pre_booking_items.gst_amount IS
  'GST for this line at the booking gst_percent.';

-- Existing bookings were stored without GST: treat total_amount as the subtotal.
UPDATE public.pre_bookings
SET
  subtotal = CASE WHEN COALESCE(subtotal, 0) = 0 THEN COALESCE(total_amount, 0) ELSE subtotal END,
  gst_total = COALESCE(gst_total, 0),
  gst_percent = COALESCE(gst_percent, 0)
WHERE COALESCE(subtotal, 0) = 0 AND COALESCE(total_amount, 0) > 0;

NOTIFY pgrst, 'reload schema';
