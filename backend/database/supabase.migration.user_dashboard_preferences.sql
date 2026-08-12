-- Per-user Executive Dashboard layout preferences (positions, sizes, visibility).
-- Supabase Dashboard → SQL Editor → Run this file.
-- File: supabase.migration.user_dashboard_preferences.sql

CREATE TABLE IF NOT EXISTS public.user_dashboard_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  layout_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.user_dashboard_preferences IS
  'Per-user Executive Dashboard layout: widget positions, sizes, and hidden state';

CREATE INDEX IF NOT EXISTS user_dashboard_preferences_updated_at_idx
  ON public.user_dashboard_preferences (updated_at DESC);

ALTER TABLE public.user_dashboard_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_dashboard_preferences_select_own ON public.user_dashboard_preferences;
CREATE POLICY user_dashboard_preferences_select_own
  ON public.user_dashboard_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_dashboard_preferences_insert_own ON public.user_dashboard_preferences;
CREATE POLICY user_dashboard_preferences_insert_own
  ON public.user_dashboard_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_dashboard_preferences_update_own ON public.user_dashboard_preferences;
CREATE POLICY user_dashboard_preferences_update_own
  ON public.user_dashboard_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_dashboard_preferences_delete_own ON public.user_dashboard_preferences;
CREATE POLICY user_dashboard_preferences_delete_own
  ON public.user_dashboard_preferences
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_dashboard_preferences TO authenticated;
GRANT ALL ON public.user_dashboard_preferences TO service_role;
