-- Pre-bookings: header + line items (invoice-style).
-- Run in Supabase SQL Editor (safe to re-run).
-- If pre_bookings already exists with a single product_id, this migrates those
-- rows into pre_booking_items and then drops the old header product columns.

CREATE TABLE IF NOT EXISTS public.pre_bookings (
  id BIGSERIAL PRIMARY KEY,
  business_id TEXT NOT NULL,
  party_id BIGINT NOT NULL REFERENCES public.parties (id) ON DELETE CASCADE,
  booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'delivered', 'cancelled')),
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pre_bookings ADD COLUMN IF NOT EXISTS booking_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.pre_bookings ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.pre_bookings ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
ALTER TABLE public.pre_bookings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'upcoming';

CREATE TABLE IF NOT EXISTS public.pre_booking_items (
  id BIGSERIAL PRIMARY KEY,
  pre_booking_id BIGINT NOT NULL REFERENCES public.pre_bookings (id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  rate NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0)
);

COMMENT ON TABLE public.pre_booking_items IS
  'Line items for a pre-booking. Header total_amount is the sum of amount.';

CREATE INDEX IF NOT EXISTS pre_booking_items_booking_idx ON public.pre_booking_items (pre_booking_id);
CREATE INDEX IF NOT EXISTS pre_booking_items_product_idx ON public.pre_booking_items (product_id);

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

-- Move legacy single-product header rows into line items.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pre_bookings' AND column_name = 'product_id'
  ) THEN
    EXECUTE $sql$
      INSERT INTO public.pre_booking_items (pre_booking_id, product_id, quantity, rate, amount)
      SELECT
        b.id,
        b.product_id,
        COALESCE(NULLIF(b.quantity, 0), 1),
        COALESCE(b.rate, 0),
        COALESCE(
          NULLIF(b.total_amount, 0),
          ROUND(COALESCE(b.rate, 0) * COALESCE(NULLIF(b.quantity, 0), 1), 2)
        )
      FROM public.pre_bookings b
      WHERE b.product_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.pre_booking_items i WHERE i.pre_booking_id = b.id
        )
    $sql$;
  END IF;
END $$;

-- Drop legacy header product columns (safe if already gone).
DO $$
DECLARE
  r record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pre_bookings' AND column_name = 'product_id'
  ) THEN
    FOR r IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.conrelid = 'public.pre_bookings'::regclass
        AND c.contype = 'f'
        AND a.attname = 'product_id'
    LOOP
      EXECUTE format('ALTER TABLE public.pre_bookings DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;

    DROP INDEX IF EXISTS pre_bookings_product_id_idx;
    ALTER TABLE public.pre_bookings DROP COLUMN IF EXISTS product_id;
    ALTER TABLE public.pre_bookings DROP COLUMN IF EXISTS quantity;
    ALTER TABLE public.pre_bookings DROP COLUMN IF EXISTS rate;
  END IF;
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
