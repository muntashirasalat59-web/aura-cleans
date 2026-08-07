-- Atomic next invoice number (includes soft-deleted rows).
-- Run once in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.next_sales_invoice_number(p_year INTEGER DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER := COALESCE(p_year, EXTRACT(YEAR FROM NOW())::INTEGER);
  v_prefix TEXT := 'INV-' || v_year::TEXT || '-';
  v_max INTEGER := 0;
  v_suffix TEXT;
  v_n INTEGER;
  r RECORD;
BEGIN
  -- Serialize allocations within a transaction
  PERFORM pg_advisory_xact_lock(87231421);

  FOR r IN
    SELECT invoice_number
    FROM public.sales
    WHERE invoice_number LIKE v_prefix || '%'
  LOOP
    v_suffix := split_part(r.invoice_number, '-', 3);
    BEGIN
      v_n := v_suffix::INTEGER;
      IF v_n > v_max THEN
        v_max := v_n;
      END IF;
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END LOOP;

  RETURN v_prefix || lpad((v_max + 1)::TEXT, 3, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_sales_invoice_number(INTEGER) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
