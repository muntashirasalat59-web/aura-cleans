-- Pre-bookings: reminder list when stock is short and a customer orders for a future date.
-- Header + line items (invoice-style). No stock reservation, no auto-invoice.
-- Supabase SQL Editor → Run (safe to re-run). Existing single-product tables:
-- also run supabase.migration.pre_bookings_items.sql to split and migrate.

CREATE TABLE IF NOT EXISTS public.pre_bookings (
  id BIGSERIAL PRIMARY KEY,
  business_id TEXT NOT NULL,
  party_id BIGINT NOT NULL REFERENCES public.parties (id) ON DELETE CASCADE,
  booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'delivered', 'cancelled')),
  gst_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  gst_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.pre_bookings IS
  'Simple future-order reminders (header). Line products live in pre_booking_items.';

CREATE INDEX IF NOT EXISTS pre_bookings_business_id_idx ON public.pre_bookings (business_id);
CREATE INDEX IF NOT EXISTS pre_bookings_delivery_date_idx ON public.pre_bookings (delivery_date);
CREATE INDEX IF NOT EXISTS pre_bookings_status_idx ON public.pre_bookings (status);
CREATE INDEX IF NOT EXISTS pre_bookings_party_id_idx ON public.pre_bookings (party_id);

ALTER TABLE public.pre_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pre_bookings_authenticated_all ON public.pre_bookings;
CREATE POLICY pre_bookings_authenticated_all
  ON public.pre_bookings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pre_bookings TO authenticated;
GRANT ALL ON public.pre_bookings TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.pre_bookings_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.pre_bookings_id_seq TO service_role;

CREATE TABLE IF NOT EXISTS public.pre_booking_items (
  id BIGSERIAL PRIMARY KEY,
  pre_booking_id BIGINT NOT NULL REFERENCES public.pre_bookings (id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  rate NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  gst_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS pre_booking_items_booking_idx ON public.pre_booking_items (pre_booking_id);

ALTER TABLE public.pre_booking_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pre_booking_items_authenticated_all ON public.pre_booking_items;
CREATE POLICY pre_booking_items_authenticated_all
  ON public.pre_booking_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pre_booking_items TO authenticated;
GRANT ALL ON public.pre_booking_items TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.pre_booking_items_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.pre_booking_items_id_seq TO service_role;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pre_bookings;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'Realtime publication not found — skip';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pre_booking_items;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'Realtime publication not found — skip';
END $$;

NOTIFY pgrst, 'reload schema';
