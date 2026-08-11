-- =============================================
-- Invoice PDFs for WhatsApp share
-- Bucket: invoices (public read)
-- Run in Supabase SQL Editor if the API cannot create the bucket.
-- =============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  true,
  10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read for WhatsApp / clients
DROP POLICY IF EXISTS "invoices_public_read" ON storage.objects;
CREATE POLICY "invoices_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'invoices');

-- Authenticated / service uploads (service role bypasses RLS; this helps client uploads if ever used)
DROP POLICY IF EXISTS "invoices_authenticated_insert" ON storage.objects;
CREATE POLICY "invoices_authenticated_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'invoices');

DROP POLICY IF EXISTS "invoices_authenticated_update" ON storage.objects;
CREATE POLICY "invoices_authenticated_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'invoices')
  WITH CHECK (bucket_id = 'invoices');
