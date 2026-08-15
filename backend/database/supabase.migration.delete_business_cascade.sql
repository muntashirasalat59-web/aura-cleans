-- Permanently delete a business and every row that belongs to it.
-- Run once in Supabase → SQL Editor → Run (safe to re-run).
--
-- Inspect live FKs (optional):
--   SELECT conrelid::regclass AS from_table, a.attname AS from_col, confrelid::regclass AS to_table
--   FROM pg_constraint c
--   JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
--   WHERE c.contype = 'f' AND confrelid IN ('public.businesses'::regclass, 'public.user_profiles'::regclass);

CREATE OR REPLACE FUNCTION public._rel_exists(p_table TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT to_regclass('public.' || p_table) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public._col_exists(p_table TEXT, p_column TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = p_table
      AND column_name = p_column
  );
$$;

CREATE OR REPLACE FUNCTION public.delete_business_cascade(p_business_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business RECORD;
  v_profile_ids UUID[] := '{}';
  v_owner_emails TEXT[] := '{}';
  v_fk RECORD;
  v_table TEXT;
  v_deleted JSONB := '{}'::jsonb;
  v_count BIGINT;
BEGIN
  IF p_business_id IS NULL OR btrim(p_business_id) = '' THEN
    RAISE EXCEPTION 'Business id is required';
  END IF;

  EXECUTE
    'SELECT id::text AS id, business_name, owner_email FROM public.businesses WHERE id::text = $1 LIMIT 1'
    INTO v_business
    USING p_business_id;

  IF v_business.id IS NULL THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  IF public._col_exists('user_profiles', 'business_id') THEN
    EXECUTE
      'SELECT COALESCE(array_agg(id), ''{}'') FROM public.user_profiles WHERE business_id::text = $1'
      INTO v_profile_ids
      USING p_business_id;
  END IF;

  IF v_business.owner_email IS NOT NULL AND public._col_exists('user_profiles', 'email') THEN
    EXECUTE
      $q$
        SELECT COALESCE(array_agg(DISTINCT id), '{}')
        FROM public.user_profiles
        WHERE lower(email) = lower($1)
           OR id = ANY($2)
      $q$
      INTO v_profile_ids
      USING v_business.owner_email, v_profile_ids;
  END IF;

  SELECT COALESCE(array_agg(email), '{}')
  INTO v_owner_emails
  FROM public.user_profiles
  WHERE id = ANY (v_profile_ids);

  -- Break leftover FKs to these profiles (e.g. sales.deleted_by).
  FOR v_fk IN
    SELECT
      c.relname AS table_name,
      a.attname AS column_name,
      conf.confdeltype
    FROM pg_constraint conf
    JOIN pg_class c ON c.oid = conf.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = conf.conrelid AND a.attnum = ANY (conf.conkey)
    JOIN pg_class ref ON ref.oid = conf.confrelid
    JOIN pg_namespace rn ON rn.oid = ref.relnamespace
    WHERE conf.contype = 'f'
      AND n.nspname = 'public'
      AND rn.nspname = 'public'
      AND ref.relname = 'user_profiles'
      AND conf.confdeltype IN ('a', 'r') -- NO ACTION / RESTRICT
  LOOP
    IF cardinality(v_profile_ids) = 0 THEN
      EXIT;
    END IF;
    EXECUTE format(
      'UPDATE public.%I SET %I = NULL WHERE %I = ANY ($1)',
      v_fk.table_name,
      v_fk.column_name,
      v_fk.column_name
    )
    USING v_profile_ids;
  END LOOP;

  -- Child rows of employees / sales / purchases before those parents.
  IF public._rel_exists('salary_payments') AND public._rel_exists('employees') AND public._col_exists('employees', 'business_id') THEN
    EXECUTE
      'DELETE FROM public.salary_payments WHERE employee_id IN (SELECT id FROM public.employees WHERE business_id::text = $1)'
      USING p_business_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('salary_payments', v_count);
  END IF;

  IF public._rel_exists('sale_items') AND public._rel_exists('sales') THEN
    IF public._col_exists('sales', 'business_id') THEN
      EXECUTE
        'DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE business_id::text = $1)'
        USING p_business_id;
    ELSIF public._col_exists('parties', 'business_id') THEN
      EXECUTE
        'DELETE FROM public.sale_items WHERE sale_id IN (
           SELECT s.id FROM public.sales s
           JOIN public.parties p ON p.id = s.party_id
           WHERE p.business_id::text = $1
         )'
        USING p_business_id;
    END IF;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('sale_items', v_count);
  END IF;

  IF public._rel_exists('purchase_items') AND public._rel_exists('purchases') THEN
    IF public._col_exists('purchases', 'business_id') THEN
      EXECUTE
        'DELETE FROM public.purchase_items WHERE purchase_id IN (SELECT id FROM public.purchases WHERE business_id::text = $1)'
        USING p_business_id;
    ELSIF public._col_exists('parties', 'business_id') THEN
      EXECUTE
        'DELETE FROM public.purchase_items WHERE purchase_id IN (
           SELECT pu.id FROM public.purchases pu
           JOIN public.parties p ON p.id = pu.party_id
           WHERE p.business_id::text = $1
         )'
        USING p_business_id;
    END IF;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('purchase_items', v_count);
  END IF;

  -- Known operational tables that may have business_id in the live DB.
  FOREACH v_table IN ARRAY ARRAY[
    'sales',
    'purchases',
    'expenses',
    'employees',
    'products',
    'parties',
    'activity_log',
    'business_settings'
  ]
  LOOP
    IF public._rel_exists(v_table) AND public._col_exists(v_table, 'business_id') THEN
      EXECUTE format('DELETE FROM public.%I WHERE business_id::text = $1', v_table)
      USING p_business_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_deleted := v_deleted || jsonb_build_object(v_table, v_count);
    ELSIF v_table IN ('sales', 'purchases')
      AND public._rel_exists(v_table)
      AND public._rel_exists('parties')
      AND public._col_exists('parties', 'business_id')
      AND public._col_exists(v_table, 'party_id')
    THEN
      EXECUTE format(
        'DELETE FROM public.%I WHERE party_id IN (SELECT id FROM public.parties WHERE business_id::text = $1)',
        v_table
      )
      USING p_business_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_deleted := v_deleted || jsonb_build_object(v_table, v_count);
    END IF;
  END LOOP;

  -- Any other table that FKs to businesses (covers employees_business_id_fkey and future tables).
  FOR v_fk IN
    SELECT
      c.relname AS table_name,
      a.attname AS column_name,
      conf.confdeltype
    FROM pg_constraint conf
    JOIN pg_class c ON c.oid = conf.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = conf.conrelid AND a.attnum = ANY (conf.conkey)
    JOIN pg_class ref ON ref.oid = conf.confrelid
    JOIN pg_namespace rn ON rn.oid = ref.relnamespace
    WHERE conf.contype = 'f'
      AND n.nspname = 'public'
      AND rn.nspname = 'public'
      AND ref.relname = 'businesses'
      AND c.relname <> 'user_profiles'
  LOOP
    IF v_fk.confdeltype = 'n' THEN
      EXECUTE format(
        'UPDATE public.%I SET %I = NULL WHERE %I::text = $1',
        v_fk.table_name,
        v_fk.column_name,
        v_fk.column_name
      )
      USING p_business_id;
    ELSE
      EXECUTE format(
        'DELETE FROM public.%I WHERE %I::text = $1',
        v_fk.table_name,
        v_fk.column_name
      )
      USING p_business_id;
    END IF;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object(v_fk.table_name, v_count);
  END LOOP;

  -- Remaining public tables with a business_id column (no FK, or added later).
  FOR v_table IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'business_id'
      AND table_name NOT IN ('businesses', 'user_profiles')
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE business_id::text = $1', v_table)
    USING p_business_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object(v_table, v_count);
  END LOOP;

  IF public._rel_exists('support_messages') AND cardinality(v_profile_ids) > 0 THEN
    DELETE FROM public.support_messages WHERE user_id = ANY (v_profile_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('support_messages', v_count);
  END IF;

  IF public._rel_exists('user_dashboard_preferences') AND cardinality(v_profile_ids) > 0 THEN
    DELETE FROM public.user_dashboard_preferences WHERE user_id = ANY (v_profile_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('user_dashboard_preferences', v_count);
  END IF;

  IF cardinality(v_profile_ids) > 0 THEN
    DELETE FROM public.user_profiles WHERE id = ANY (v_profile_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('user_profiles', v_count);
  END IF;

  EXECUTE 'DELETE FROM public.businesses WHERE id::text = $1' USING p_business_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Business could not be deleted';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'business_id', v_business.id,
    'business_name', v_business.business_name,
    'profile_ids', to_jsonb(v_profile_ids),
    'owner_emails', to_jsonb(v_owner_emails),
    'deleted', v_deleted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_business_cascade(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_business_cascade(TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
