-- Purchase payables (mirror sales receivables)
-- Supabase SQL Editor → Run this file

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS payment_due_date DATE,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchases_payment_status_check'
  ) THEN
    ALTER TABLE public.purchases
      ADD CONSTRAINT purchases_payment_status_check
      CHECK (payment_status IN ('paid', 'pending', 'partial'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchases_amount_paid_check'
  ) THEN
    ALTER TABLE public.purchases
      ADD CONSTRAINT purchases_amount_paid_check
      CHECK (amount_paid >= 0);
  END IF;
END $$;

-- Existing rows: treat as paid (no due date)
UPDATE public.purchases
SET
  amount_paid = COALESCE(total_amount, 0),
  payment_status = 'paid',
  payment_due_date = NULL
WHERE COALESCE(payment_status, '') = ''
   OR (payment_due_date IS NULL AND COALESCE(amount_paid, 0) = 0);

COMMENT ON COLUMN public.purchases.payment_status IS
  'paid | pending | partial — amount we still owe the supplier';
COMMENT ON COLUMN public.purchases.payment_due_date IS
  'When payment to supplier is due (null if paid)';
COMMENT ON COLUMN public.purchases.amount_paid IS
  'Amount already paid to supplier against this purchase';

NOTIFY pgrst, 'reload schema';
