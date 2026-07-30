-- =============================================
-- Expenses module — run in Supabase SQL Editor
-- Safe to run once (uses IF NOT EXISTS)
-- =============================================

CREATE TABLE IF NOT EXISTS public.expenses (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN (
      'Rent',
      'Salary',
      'Electricity',
      'Transport',
      'Maintenance',
      'Marketing',
      'Other'
    )
  ),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  expense_date DATE NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'Bank', 'UPI')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses (expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses (category);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_all" ON public.expenses;
CREATE POLICY "expenses_all" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.expenses TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.expenses_id_seq TO anon, authenticated, service_role;
