-- Monthly sales target for Business Health progress ring.
-- Supabase SQL Editor → Run this file.

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS monthly_sales_target NUMERIC(14, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.business_settings.monthly_sales_target IS
  'Admin-set monthly revenue target (₹) for dashboard sales progress';
