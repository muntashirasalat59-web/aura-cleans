-- =============================================
-- 99 — One database, many businesses: business_id on every table + row security
-- Runs LAST in supabase.full-setup.sql.
--
-- * Every business table gets business_id, filled in automatically from the signed-in
--   user's profile (public.current_business_id()), so the API and the RPC functions
--   never have to pass it.
-- * Row Level Security only shows a business its own rows. The backend's service-role
--   key (used for admin tasks) bypasses this, as before.
-- =============================================

-- Old 5-argument versions are superseded by the 6-argument ones (with p_payment).
DROP FUNCTION IF EXISTS public.create_sale(BIGINT, TEXT, DATE, NUMERIC, JSONB);
DROP FUNCTION IF EXISTS public.update_sale(BIGINT, BIGINT, DATE, NUMERIC, JSONB);

-- business_settings: the old file made a single-row table (id = 1); the app keeps one row
-- per business and upserts ON CONFLICT (business_id).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business_settings' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE public.business_settings DROP CONSTRAINT IF EXISTS business_settings_id_check;
    ALTER TABLE public.business_settings ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE public.business_settings ALTER COLUMN id TYPE BIGINT;
    CREATE SEQUENCE IF NOT EXISTS public.business_settings_id_seq OWNED BY public.business_settings.id;
    PERFORM setval('public.business_settings_id_seq', GREATEST((SELECT MAX(id) FROM public.business_settings), 1));
    ALTER TABLE public.business_settings
      ALTER COLUMN id SET DEFAULT nextval('public.business_settings_id_seq');
    ALTER TABLE public.business_settings ADD COLUMN business_id UUID;
  END IF;
END $$;

ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS signature_url TEXT NOT NULL DEFAULT '';
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS stamp_url TEXT NOT NULL DEFAULT '';
GRANT USAGE, SELECT ON SEQUENCE public.business_settings_id_seq TO authenticated, service_role;

-- Activity log: allow every action/entity the app records (employees, offers, cities, ...).
ALTER TABLE public.activity_log DROP CONSTRAINT IF EXISTS activity_log_action_type_check;
ALTER TABLE public.activity_log DROP CONSTRAINT IF EXISTS activity_log_entity_type_check;
ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_action_type_check CHECK (
  action_type IN ('create', 'update', 'delete', 'mark_paid', 'mark_salary_paid',
                  'cancel', 'deactivate', 'reactivate')
);
ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_entity_type_check CHECK (
  entity_type IN ('product', 'party', 'purchase', 'sale', 'expense', 'settings', 'employee',
                  'offer', 'pre_booking', 'business_city')
);

-- UUID business_id + default + FK on every business table.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products', 'parties', 'purchases', 'purchase_items', 'sales', 'sale_items',
    'expenses', 'employees', 'salary_payments', 'activity_log', 'business_settings'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS business_id UUID', t);
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN business_id SET DEFAULT public.current_business_id()', t);
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_business_id_fkey');
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (business_id) REFERENCES public.businesses (id) ON DELETE CASCADE',
      t, t || '_business_id_fkey');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (business_id)', t || '_business_id_idx', t);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS business_settings_business_id_key
  ON public.business_settings (business_id);

-- Tables created with a TEXT business_id (cities, offers, pre-bookings): default only.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['business_cities', 'offers', 'offer_items', 'pre_bookings', 'pre_booking_items']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'business_id'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN business_id SET DEFAULT public.current_business_id()::text', t);
    END IF;
  END LOOP;
END $$;

-- Row Level Security: replace the open "USING (true)" policies with per-business ones.
DO $$
DECLARE
  t TEXT;
  pol RECORD;
  cond TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products', 'parties', 'purchases', 'purchase_items', 'sales', 'sale_items',
    'expenses', 'employees', 'salary_payments', 'activity_log', 'business_settings',
    'business_cities', 'offers', 'offer_items', 'pre_bookings', 'pre_booking_items'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'business_id'
        AND data_type = 'uuid'
    ) THEN
      cond := 'business_id = public.current_business_id()';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'business_id'
    ) THEN
      cond := 'business_id = public.current_business_id()::text';
    ELSE
      CONTINUE;  -- no business_id column: leave this table's policies alone
    END IF;

    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
      t || '_own_business', t, cond, cond);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    -- Signed-out (anon) requests get nothing.
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

-- Line tables without their own business_id follow their parent row.
DROP POLICY IF EXISTS offer_items_authenticated_all ON public.offer_items;
DROP POLICY IF EXISTS offer_items_own_business ON public.offer_items;
CREATE POLICY offer_items_own_business ON public.offer_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.offers o
    WHERE o.id = offer_id AND o.business_id = public.current_business_id()::text))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.offers o
    WHERE o.id = offer_id AND o.business_id = public.current_business_id()::text));
REVOKE ALL ON public.offer_items FROM anon;

DROP POLICY IF EXISTS pre_booking_items_authenticated_all ON public.pre_booking_items;
DROP POLICY IF EXISTS pre_booking_items_own_business ON public.pre_booking_items;
CREATE POLICY pre_booking_items_own_business ON public.pre_booking_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pre_bookings b
    WHERE b.id = pre_booking_id AND b.business_id = public.current_business_id()::text))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.pre_bookings b
    WHERE b.id = pre_booking_id AND b.business_id = public.current_business_id()::text));
REVOKE ALL ON public.pre_booking_items FROM anon;

-- business_cities seeds a city for the OLD live database's business id; drop rows
-- that don't belong to any business in this database.
DELETE FROM public.business_cities
WHERE business_id NOT IN (SELECT id::text FROM public.businesses);

-- Teammates in the same business can see each other's profile (own row always visible).
DROP POLICY IF EXISTS user_profiles_select_same_business ON public.user_profiles;
CREATE POLICY user_profiles_select_same_business ON public.user_profiles
  FOR SELECT TO authenticated
  USING (business_id IS NOT NULL AND business_id = public.current_business_id());
REVOKE ALL ON public.user_profiles FROM anon;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- Storage bucket for logo / signature / stamp uploads (Business settings page).
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-assets', 'business-assets', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "business_assets_public_read" ON storage.objects;
CREATE POLICY "business_assets_public_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'business-assets');

-- =============================================
-- First owner login (email + password)
-- 1. Supabase -> Authentication -> Users -> Add user (tick "Auto Confirm User").
-- 2. Run once, with that email:
--      SELECT public.setup_business_owner('you@example.com', 'Aura Cleans', 'Your Name');
-- (Signing up from the app's own Sign-up page also creates the business + owner.)
-- =============================================
CREATE OR REPLACE FUNCTION public.setup_business_owner(
  p_email TEXT,
  p_business_name TEXT DEFAULT 'Aura Cleans',
  p_full_name TEXT DEFAULT 'Owner'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_business_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(btrim(p_email)) LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No login found for %. Create it first in Authentication -> Users.', p_email;
  END IF;

  SELECT business_id INTO v_business_id FROM public.user_profiles WHERE id = v_user_id;
  IF v_business_id IS NULL THEN
    INSERT INTO public.businesses (business_name, owner_email, status, payment_status)
    VALUES (p_business_name, lower(btrim(p_email)), 'active', 'paid')
    RETURNING id INTO v_business_id;
  END IF;

  INSERT INTO public.user_profiles (id, full_name, email, role, business_id)
  VALUES (v_user_id, p_full_name, lower(btrim(p_email)), 'admin', v_business_id)
  ON CONFLICT (id) DO UPDATE
    SET role = 'admin', business_id = EXCLUDED.business_id;

  INSERT INTO public.business_settings (business_id, company_name)
  VALUES (v_business_id, p_business_name)
  ON CONFLICT (business_id) DO NOTHING;

  RETURN v_business_id;
END;
$$;

REVOKE ALL ON FUNCTION public.setup_business_owner(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
