-- Singleton business profile for invoices / letterhead.
-- Supabase Dashboard → SQL Editor → Run this file.

CREATE TABLE IF NOT EXISTS public.business_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_name TEXT NOT NULL DEFAULT '',
  address_line1 TEXT NOT NULL DEFAULT '',
  address_line2 TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  gstin TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  bank_name TEXT NOT NULL DEFAULT '',
  bank_account_number TEXT NOT NULL DEFAULT '',
  upi_id TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.business_settings IS
  'Single-row company letterhead & bank details for invoices';

ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_settings_select_authenticated ON public.business_settings;
CREATE POLICY business_settings_select_authenticated
  ON public.business_settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS business_settings_update_authenticated ON public.business_settings;
CREATE POLICY business_settings_update_authenticated
  ON public.business_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.business_settings TO authenticated;
GRANT ALL ON public.business_settings TO service_role;
