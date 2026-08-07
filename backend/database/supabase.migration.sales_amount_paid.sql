-- Per-invoice collection tracking for pending / partial / paid receivables.
-- Run in Supabase SQL Editor once.

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0
  CHECK (amount_paid >= 0);

COMMENT ON COLUMN public.sales.amount_paid IS
  'Amount collected against this invoice. balance_due = total_amount - amount_paid.';

-- Existing credit invoices (have a due date) stay unpaid; cash/settled invoices (no due date) mark fully paid.
UPDATE public.sales
SET amount_paid = CASE
  WHEN payment_due_date IS NOT NULL THEN 0
  ELSE COALESCE(total_amount, 0)
END
WHERE amount_paid = 0
  AND (payment_due_date IS NOT NULL OR COALESCE(total_amount, 0) > 0);

-- Extend payment JSON applier used by create_sale / update_sale RPCs.
CREATE OR REPLACE FUNCTION public.apply_sale_payment_from_json(p_sale_id BIGINT, p_payment JSONB)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total NUMERIC(12, 2);
  v_paid NUMERIC(12, 2);
  v_due TEXT;
BEGIN
  IF p_payment IS NULL OR p_payment = 'null'::jsonb THEN
    RETURN;
  END IF;

  SELECT total_amount INTO v_total FROM public.sales WHERE id = p_sale_id;

  v_due := NULLIF(trim(p_payment->>'payment_due_date'), '');

  IF p_payment ? 'amount_paid' AND NULLIF(trim(p_payment->>'amount_paid'), '') IS NOT NULL THEN
    v_paid := GREATEST(0, LEAST(v_total, (p_payment->>'amount_paid')::NUMERIC));
  ELSIF v_due IS NOT NULL THEN
    v_paid := 0;
  ELSE
    v_paid := COALESCE(v_total, 0);
  END IF;

  UPDATE public.sales
  SET
    payment_bank_name = NULLIF(trim(p_payment->>'payment_bank_name'), ''),
    payment_account_number = NULLIF(trim(p_payment->>'payment_account_number'), ''),
    payment_upi = NULLIF(trim(p_payment->>'payment_upi'), ''),
    payment_terms = NULLIF(trim(p_payment->>'payment_terms'), ''),
    payment_due_date = CASE
      WHEN v_due IS NULL THEN NULL
      ELSE v_due::DATE
    END,
    amount_paid = v_paid
  WHERE id = p_sale_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
