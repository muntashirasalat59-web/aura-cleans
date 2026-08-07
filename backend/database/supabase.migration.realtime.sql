-- Enable Supabase Realtime for app tables (run once in Supabase SQL Editor).
-- Required for automatic UI updates when rows change in Supabase dashboard.

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'parties',
      'products',
      'sales',
      'sale_items',
      'purchases',
      'purchase_items',
      'expenses',
      'employees',
      'user_profiles'
    ])
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
        tbl
      );
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
      WHEN undefined_object THEN
        RAISE NOTICE 'Table % not found — skip', tbl;
    END;
  END LOOP;
END $$;
