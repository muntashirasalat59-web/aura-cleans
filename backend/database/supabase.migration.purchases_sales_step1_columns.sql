-- =============================================
-- STEP 1 of 2 — Run this FIRST in Supabase SQL Editor
-- Adds missing columns to purchases & sales (no functions)
-- Safe to re-run
-- =============================================

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS gst_percent NUMERIC(5, 2) NOT NULL DEFAULT 18;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.purchases
SET subtotal = total_amount, gst_amount = 0, gst_percent = 18
WHERE total_amount > 0 AND (subtotal IS NULL OR subtotal = 0);

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS gst_percent NUMERIC(5, 2) NOT NULL DEFAULT 18;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS invoice_date DATE;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.sales
SET subtotal = total_amount, gst_amount = 0, gst_percent = 18
WHERE total_amount > 0 AND (subtotal IS NULL OR subtotal = 0);

NOTIFY pgrst, 'reload schema';
