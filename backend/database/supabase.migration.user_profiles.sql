-- =============================================
-- User profiles (roles) + Supabase Auth
-- Run in Supabase SQL Editor after enabling Email auth
-- =============================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles (role);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles (email);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_admin_all" ON public.user_profiles;

-- Signed-in users can read their own profile (for client-side checks if needed)
CREATE POLICY "user_profiles_select_own" ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Inserts/updates/deletes for profiles are done via backend service role (Admin API)

GRANT SELECT ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;

-- =============================================
-- FIRST ADMIN (one-time, after you create a login in Authentication → Users):
--
-- INSERT INTO public.user_profiles (id, full_name, email, role)
-- VALUES (
--   'PASTE-AUTH-USER-UUID-HERE',
--   'Business Owner',
--   'owner@example.com',
--   'admin'
-- );
-- =============================================
