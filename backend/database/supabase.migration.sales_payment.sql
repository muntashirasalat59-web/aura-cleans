-- Optional per-invoice payment details (bank, UPI, terms, due date)
-- Run in Supabase SQL Editor if invoice save fails with missing payment_* columns.
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_bank_name TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_account_number TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_ifsc TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_upi TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_due_date DATE;

COMMENT ON COLUMN public.sales.payment_bank_name IS 'Optional bank name for invoice payment section';
COMMENT ON COLUMN public.sales.payment_account_number IS 'Optional bank account number on invoice';
COMMENT ON COLUMN public.sales.payment_ifsc IS 'Optional IFSC code on invoice';
COMMENT ON COLUMN public.sales.payment_upi IS 'Optional UPI ID on invoice';
COMMENT ON COLUMN public.sales.payment_terms IS 'Optional custom payment terms / note on invoice';
COMMENT ON COLUMN public.sales.payment_due_date IS 'Optional payment due date';

-- Refresh PostgREST schema cache (fixes "Could not find column in schema cache")
NOTIFY pgrst, 'reload schema';
