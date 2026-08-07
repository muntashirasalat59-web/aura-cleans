-- Fixes: function public.apply_sale_payment_from_json(bigint, jsonb) does not exist
-- Run this ONCE in Supabase → SQL Editor → Run
-- (Required by create_sale / update_sale payment path)

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS payment_bank_name TEXT,
  ADD COLUMN IF NOT EXISTS payment_account_number TEXT,
  ADD COLUMN IF NOT EXISTS payment_ifsc TEXT,
  ADD COLUMN IF NOT EXISTS payment_upi TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS payment_due_date DATE,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_payment_status_check'
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_payment_status_check
      CHECK (payment_status IN ('paid', 'pending', 'partial'));
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

CREATE OR REPLACE FUNCTION public.apply_sale_payment_from_json(p_sale_id BIGINT, p_payment JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC(12, 2);
  v_paid NUMERIC(12, 2);
  v_due TEXT;
  v_status TEXT;
BEGIN
  IF p_payment IS NULL OR p_payment = 'null'::jsonb THEN
    RETURN;
  END IF;

  SELECT total_amount INTO v_total FROM public.sales WHERE id = p_sale_id;

  v_due := NULLIF(trim(p_payment->>'payment_due_date'), '');
  v_status := lower(COALESCE(NULLIF(trim(p_payment->>'payment_status'), ''), ''));

  IF v_status = 'paid' THEN
    v_paid := COALESCE(v_total, 0);
    v_due := NULL;
  ELSIF v_status = 'pending' THEN
    IF p_payment ? 'amount_paid' AND NULLIF(trim(p_payment->>'amount_paid'), '') IS NOT NULL THEN
      v_paid := GREATEST(0, LEAST(COALESCE(v_total, 0), (p_payment->>'amount_paid')::NUMERIC));
    ELSE
      v_paid := 0;
    END IF;
  ELSIF p_payment ? 'amount_paid' AND NULLIF(trim(p_payment->>'amount_paid'), '') IS NOT NULL THEN
    v_paid := GREATEST(0, LEAST(COALESCE(v_total, 0), (p_payment->>'amount_paid')::NUMERIC));
  ELSIF v_due IS NOT NULL THEN
    v_paid := 0;
  ELSE
    v_paid := COALESCE(v_total, 0);
  END IF;

  IF v_paid >= COALESCE(v_total, 0) THEN
    v_status := 'paid';
  ELSIF v_paid > 0 THEN
    v_status := 'partial';
  ELSE
    v_status := 'pending';
  END IF;

  UPDATE public.sales
  SET
    payment_bank_name = NULLIF(trim(p_payment->>'payment_bank_name'), ''),
    payment_account_number = NULLIF(trim(p_payment->>'payment_account_number'), ''),
    payment_upi = NULLIF(trim(p_payment->>'payment_upi'), ''),
    payment_terms = NULLIF(trim(p_payment->>'payment_terms'), ''),
    payment_due_date = CASE
      WHEN v_status = 'paid' OR v_due IS NULL THEN NULL
      ELSE v_due::DATE
    END,
    amount_paid = v_paid,
    payment_status = v_status
  WHERE id = p_sale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_sale_payment_from_json(BIGINT, JSONB) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
