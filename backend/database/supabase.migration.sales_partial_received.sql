-- Partial collections on invoices (Amount Received / Balance Due).
-- Run once in Supabase → SQL Editor → Run.
-- Safe to re-run. Existing invoices without a received amount stay fully pending.

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid';

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS payment_due_date DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_amount_paid_check'
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_amount_paid_check CHECK (amount_paid >= 0);
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_payment_status_check;
  ALTER TABLE public.sales
    ADD CONSTRAINT sales_payment_status_check
    CHECK (payment_status IN ('paid', 'pending', 'partial'));
EXCEPTION WHEN others THEN
  NULL;
END $$;

COMMENT ON COLUMN public.sales.amount_paid IS
  'Amount received against this invoice. Balance due = total_amount - amount_paid. Null/0 = nothing received (full amount pending).';
COMMENT ON COLUMN public.sales.payment_status IS
  'paid | pending | partial — derived from amount_paid vs total_amount';

-- Newly added column defaults to 0. Credit invoices (due date, unpaid) stay 0.
-- Settled invoices that still show 0 with no due date are treated as fully received.
UPDATE public.sales
SET amount_paid = COALESCE(total_amount, 0)
WHERE COALESCE(amount_paid, 0) = 0
  AND payment_due_date IS NULL
  AND COALESCE(payment_status, 'paid') = 'paid';

UPDATE public.sales
SET payment_status = CASE
  WHEN COALESCE(total_amount, 0) <= 0 OR COALESCE(amount_paid, 0) >= COALESCE(total_amount, 0) THEN 'paid'
  WHEN COALESCE(amount_paid, 0) > 0 THEN 'partial'
  ELSE 'pending'
END;

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
  v_paid_raw TEXT;
BEGIN
  IF p_payment IS NULL OR p_payment = 'null'::jsonb THEN
    RETURN;
  END IF;

  SELECT total_amount INTO v_total FROM public.sales WHERE id = p_sale_id;

  v_due := NULLIF(trim(p_payment->>'payment_due_date'), '');
  v_status := lower(COALESCE(NULLIF(trim(p_payment->>'payment_status'), ''), ''));
  v_paid_raw := COALESCE(
    NULLIF(trim(p_payment->>'amount_paid'), ''),
    NULLIF(trim(p_payment->>'amount_received'), '')
  );

  IF v_status = 'paid' THEN
    v_paid := COALESCE(v_total, 0);
    v_due := NULL;
  ELSIF v_status IN ('pending', 'partial') THEN
    IF v_paid_raw IS NOT NULL THEN
      v_paid := GREATEST(0, LEAST(COALESCE(v_total, 0), v_paid_raw::NUMERIC));
    ELSE
      v_paid := 0;
    END IF;
  ELSIF v_paid_raw IS NOT NULL THEN
    v_paid := GREATEST(0, LEAST(COALESCE(v_total, 0), v_paid_raw::NUMERIC));
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
