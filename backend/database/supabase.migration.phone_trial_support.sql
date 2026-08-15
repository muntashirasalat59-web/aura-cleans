-- Phone signup + trial dates + support chat.
-- Run once in Supabase → SQL Editor → Run.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_phone_unique
  ON public.user_profiles (phone)
  WHERE phone IS NOT NULL AND btrim(phone) <> '';

CREATE TABLE IF NOT EXISTS public.support_messages (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.user_profiles (id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('customer', 'admin')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_read BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_support_messages_user_created
  ON public.support_messages (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_unread
  ON public.support_messages (user_id)
  WHERE is_read = false AND sender = 'customer';

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_messages_select_own ON public.support_messages;
CREATE POLICY support_messages_select_own
  ON public.support_messages FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS support_messages_insert_own ON public.support_messages;
CREATE POLICY support_messages_insert_own
  ON public.support_messages FOR INSERT
  WITH CHECK (user_id = auth.uid() AND sender = 'customer');

GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.support_messages_id_seq TO authenticated;

COMMENT ON COLUMN public.user_profiles.phone IS
  'Indian mobile (10 digits). Auth email is {phone}@phone.auraclean.internal';
COMMENT ON TABLE public.support_messages IS
  'Trial-expiry support thread between a customer and the platform admin';

NOTIFY pgrst, 'reload schema';
