-- =============================================
-- 00 — Businesses + user profiles (needed by everything else)
-- The app is multi-business: every login belongs to one business (user_profiles.business_id).
-- These tables existed in the old live database but were never in the repo's SQL files.
-- =============================================

CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL DEFAULT '',
  owner_email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  subscription_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  payment_due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  business_id UUID REFERENCES public.businesses (id) ON DELETE SET NULL,
  phone TEXT,
  trial_ends_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  is_platform_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The code accepts 'super_admin' as well as admin/staff.
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check CHECK (role IN ('admin', 'staff', 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_user_profiles_business ON public.user_profiles (business_id);

/** The signed-in user's business (NULL for the service role / no profile). */
CREATE OR REPLACE FUNCTION public.current_business_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT business_id FROM public.user_profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_business_id() TO anon, authenticated, service_role;

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS businesses_select_own ON public.businesses;
CREATE POLICY businesses_select_own ON public.businesses
  FOR SELECT TO authenticated
  USING (id = public.current_business_id());

GRANT SELECT ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
