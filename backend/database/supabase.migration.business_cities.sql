-- City/Branch tracking: per-business city list + optional tag on sales.
-- Invoice PDF/print is unchanged — city is stored only as metadata.
-- Supabase Dashboard → SQL Editor → Run this file (safe to re-run).

CREATE TABLE IF NOT EXISTS public.business_cities (
  id BIGSERIAL PRIMARY KEY,
  business_id TEXT NOT NULL,
  city_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.business_cities IS
  'Dynamic city/branch list per business. Used to tag invoices; not shown on the PDF.';

CREATE UNIQUE INDEX IF NOT EXISTS business_cities_business_name_lower
  ON public.business_cities (business_id, lower(btrim(city_name)));

CREATE INDEX IF NOT EXISTS business_cities_business_id_idx
  ON public.business_cities (business_id);

ALTER TABLE public.business_cities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_cities_authenticated_all ON public.business_cities;
CREATE POLICY business_cities_authenticated_all
  ON public.business_cities
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_cities TO authenticated;
GRANT ALL ON public.business_cities TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.business_cities_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.business_cities_id_seq TO service_role;

-- Seed one default city per business (letterhead city, else Ahmedabad).
DO $$
BEGIN
  IF to_regclass('public.businesses') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'business_settings' AND column_name = 'business_id'
    ) THEN
      INSERT INTO public.business_cities (business_id, city_name, is_active)
      SELECT DISTINCT ON (b.id::text)
        b.id::text,
        COALESCE(NULLIF(btrim(bs.city), ''), 'Ahmedabad'),
        true
      FROM public.businesses b
      LEFT JOIN public.business_settings bs ON bs.business_id::text = b.id::text
      WHERE NOT EXISTS (
        SELECT 1 FROM public.business_cities c WHERE c.business_id = b.id::text
      );
    ELSE
      INSERT INTO public.business_cities (business_id, city_name, is_active)
      SELECT b.id::text, 'Ahmedabad', true
      FROM public.businesses b
      WHERE NOT EXISTS (
        SELECT 1 FROM public.business_cities c WHERE c.business_id = b.id::text
      );
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'business_id'
  ) THEN
    INSERT INTO public.business_cities (business_id, city_name, is_active)
    SELECT DISTINCT up.business_id::text, 'Ahmedabad', true
    FROM public.user_profiles up
    WHERE up.business_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.business_cities c WHERE c.business_id = up.business_id::text
      );
  END IF;
END $$;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS city_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_city_id_fkey'
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_city_id_fkey
      FOREIGN KEY (city_id)
      REFERENCES public.business_cities(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS sales_city_id_idx ON public.sales (city_id);

COMMENT ON COLUMN public.sales.city_id IS
  'Optional city/branch tag for reporting. Not printed on the invoice PDF.';

-- Backfill existing invoices to that business's first/default city.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'business_id'
  ) THEN
    UPDATE public.sales s
    SET city_id = sub.city_id
    FROM (
      SELECT DISTINCT ON (s2.id) s2.id AS sale_id, c.id AS city_id
      FROM public.sales s2
      JOIN public.business_cities c ON c.business_id = s2.business_id::text
      WHERE s2.city_id IS NULL
      ORDER BY s2.id, c.id
    ) sub
    WHERE s.id = sub.sale_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'parties' AND column_name = 'business_id'
  ) THEN
    UPDATE public.sales s
    SET city_id = sub.city_id
    FROM (
      SELECT DISTINCT ON (s2.id) s2.id AS sale_id, c.id AS city_id
      FROM public.sales s2
      JOIN public.parties p ON p.id = s2.party_id
      JOIN public.business_cities c ON c.business_id = p.business_id::text
      WHERE s2.city_id IS NULL
      ORDER BY s2.id, c.id
    ) sub
    WHERE s.id = sub.sale_id;
  END IF;

  -- Single-tenant fallback: leftover invoices get the only city's id.
  IF (SELECT COUNT(DISTINCT business_id) FROM public.business_cities) = 1 THEN
    UPDATE public.sales
    SET city_id = (SELECT id FROM public.business_cities ORDER BY id LIMIT 1)
    WHERE city_id IS NULL;
  END IF;
END $$;

-- Realtime so the settings list refreshes across tabs.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.business_cities;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'Realtime publication not found — skip';
END $$;

NOTIFY pgrst, 'reload schema';
