-- =============================================
-- Sales: invoice discount
-- Run once in Supabase SQL Editor.
-- discount_amount is in rupees and is taken off the subtotal before GST:
--   total_amount = (subtotal - discount_amount) + gst_amount
-- =============================================

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0);

COMMENT ON COLUMN public.sales.discount_amount IS
  'Invoice discount in rupees, applied to the subtotal before GST.';
