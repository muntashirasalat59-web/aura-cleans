-- Explicit payment_status for invoices (paid / pending / partial).
-- Depends on amount_paid + payment_due_date (see supabase.migration.sales_amount_paid.sql).
-- Run in Supabase SQL Editor once.

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0
  CHECK (amount_paid >= 0);

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS payment_due_date DATE;

ALTER TABLE public.sales
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
END $$;

COMMENT ON COLUMN public.sales.payment_status IS
  'paid | pending | partial — kept in sync with amount_paid vs total_amount';

-- Backfill status from amounts; credit invoices (due date, unpaid) → pending
UPDATE public.sales
SET
  amount_paid = CASE
    WHEN payment_due_date IS NOT NULL AND COALESCE(amount_paid, 0) = 0 THEN 0
    WHEN COALESCE(amount_paid, 0) = 0 AND payment_due_date IS NULL THEN COALESCE(total_amount, 0)
    ELSE amount_paid
  END
WHERE TRUE;

UPDATE public.sales
SET payment_status = CASE
  WHEN COALESCE(total_amount, 0) <= 0 OR COALESCE(amount_paid, 0) >= COALESCE(total_amount, 0) THEN 'paid'
  WHEN COALESCE(amount_paid, 0) > 0 THEN 'partial'
  ELSE 'pending'
END;

CREATE OR REPLACE FUNCTION public.apply_sale_payment_from_json(p_sale_id BIGINT, p_payment JSONB)
RETURNS void
LANGUAGE plpgsql
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
      v_paid := GREATEST(0, LEAST(v_total, (p_payment->>'amount_paid')::NUMERIC));
    ELSE
      v_paid := 0;
    END IF;
  ELSIF p_payment ? 'amount_paid' AND NULLIF(trim(p_payment->>'amount_paid'), '') IS NOT NULL THEN
    v_paid := GREATEST(0, LEAST(v_total, (p_payment->>'amount_paid')::NUMERIC));
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

NOTIFY pgrst, 'reload schema';
