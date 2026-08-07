-- Activity / audit log — who created/updated/deleted what
-- Supabase SQL Editor → Run this file

CREATE TABLE IF NOT EXISTS public.activity_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  user_name TEXT NOT NULL DEFAULT '',
  action_type TEXT NOT NULL CHECK (
    action_type IN ('create', 'update', 'delete', 'mark_paid')
  ),
  entity_type TEXT NOT NULL CHECK (
    entity_type IN ('product', 'party', 'purchase', 'sale', 'expense', 'settings')
  ),
  entity_id TEXT,
  entity_name TEXT NOT NULL DEFAULT '',
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_log_created_at_idx
  ON public.activity_log (created_at DESC);

CREATE INDEX IF NOT EXISTS activity_log_user_id_idx
  ON public.activity_log (user_id);

CREATE INDEX IF NOT EXISTS activity_log_action_type_idx
  ON public.activity_log (action_type);

CREATE INDEX IF NOT EXISTS activity_log_entity_type_idx
  ON public.activity_log (entity_type);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_log_all ON public.activity_log;
CREATE POLICY activity_log_all ON public.activity_log
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.activity_log TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.activity_log_id_seq TO anon, authenticated, service_role;

COMMENT ON TABLE public.activity_log IS
  'Audit trail of create/update/delete/mark_paid actions by logged-in users';

NOTIFY pgrst, 'reload schema';
