-- =============================================
-- Offers as fixed combo packages + pre_bookings.offer_id
-- Run in Supabase SQL Editor. Safe to re-run.
-- =============================================

CREATE TABLE IF NOT EXISTS public.offers (
  id BIGSERIAL PRIMARY KEY,
  business_id TEXT NOT NULL,
  offer_name TEXT NOT NULL,
  combo_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (combo_price >= 0),
  valid_from DATE,
  valid_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.offers IS
  'Fixed combo packages (e.g. ₹349 Combo). combo_price is the final amount the customer pays for the whole set.';
COMMENT ON COLUMN public.offers.combo_price IS
  'Final fixed price for the entire combo, not a per-product discount.';

CREATE INDEX IF NOT EXISTS offers_business_id_idx ON public.offers (business_id);
CREATE INDEX IF NOT EXISTS offers_is_active_idx ON public.offers (is_active);
CREATE INDEX IF NOT EXISTS offers_valid_from_idx ON public.offers (valid_from);
CREATE INDEX IF NOT EXISTS offers_valid_to_idx ON public.offers (valid_to);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS offers_authenticated_all ON public.offers;
CREATE POLICY offers_authenticated_all
  ON public.offers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.offers_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.offers_id_seq TO service_role;

CREATE TABLE IF NOT EXISTS public.offer_items (
  id BIGSERIAL PRIMARY KEY,
  offer_id BIGINT NOT NULL REFERENCES public.offers (id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  rate NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.offer_items IS
  'Fixed products, quantities, and combo-specific retail rates included in a combo offer.';
COMMENT ON COLUMN public.offer_items.rate IS
  'Retail unit rate for this product inside this combo. May differ from products.retail_price.';

CREATE INDEX IF NOT EXISTS offer_items_offer_idx ON public.offer_items (offer_id);
CREATE INDEX IF NOT EXISTS offer_items_product_idx ON public.offer_items (product_id);

ALTER TABLE public.offer_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS offer_items_authenticated_all ON public.offer_items;
CREATE POLICY offer_items_authenticated_all
  ON public.offer_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_items TO authenticated;
GRANT ALL ON public.offer_items TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.offer_items_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.offer_items_id_seq TO service_role;

ALTER TABLE public.offer_items
  ADD COLUMN IF NOT EXISTS rate NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (rate >= 0);

ALTER TABLE public.pre_bookings
  ADD COLUMN IF NOT EXISTS offer_id BIGINT REFERENCES public.offers (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pre_bookings_offer_id_idx ON public.pre_bookings (offer_id);

COMMENT ON COLUMN public.pre_bookings.offer_id IS
  'Optional combo offer used when this pre-booking was created. Null = manual line items.';

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.offers;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'Realtime publication not found — skip offers';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.offer_items;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'Realtime publication not found — skip offer_items';
END $$;

NOTIFY pgrst, 'reload schema';
