-- GST vs Non-GST invoice flag.
-- Run once in Supabase → SQL Editor → Run.

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS is_gst_invoice BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.sales.is_gst_invoice IS
  'true = TAX INVOICE with GST. false = plain INVOICE: gst_percent/gst_amount must be 0 and total_amount = subtotal.';

UPDATE public.sales
SET is_gst_invoice = false
WHERE COALESCE(gst_percent, 0) <= 0;

NOTIFY pgrst, 'reload schema';
