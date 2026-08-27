-- =============================================
-- Products: retail_price (dual price system)
-- Run in Supabase SQL Editor. Safe to re-run.
--
-- Existing `price` stays as the wholesale / B2B selling price.
-- `retail_price` is the consumer / MRP rate used on invoices when
-- the line-item price type is Retail.
-- =============================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS retail_price NUMERIC(12, 2) NOT NULL DEFAULT 0;

UPDATE public.products
SET retail_price = price
WHERE COALESCE(retail_price, 0) = 0
  AND COALESCE(price, 0) > 0;

COMMENT ON COLUMN public.products.price IS
  'Wholesale selling price (B2B). Previously labelled selling price.';
COMMENT ON COLUMN public.products.retail_price IS
  'Retail / consumer selling price (MRP). Used when an invoice line is set to Retail.';

NOTIFY pgrst, 'reload schema';
