-- =============================================
-- Employees + salary payments — Supabase SQL Editor
-- Safe to run once (uses IF NOT EXISTS)
-- =============================================

CREATE TABLE IF NOT EXISTS public.employees (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (
    role IN ('Salesman', 'Manager', 'Accountant', 'Delivery Boy')
  ),
  contact TEXT NOT NULL DEFAULT '',
  salary NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (salary >= 0),
  joining_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees (status);
CREATE INDEX IF NOT EXISTS idx_employees_joining_date ON public.employees (joining_date);

CREATE TABLE IF NOT EXISTS public.salary_payments (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  paid_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, month)
);

CREATE INDEX IF NOT EXISTS idx_salary_payments_employee ON public.salary_payments (employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_month ON public.salary_payments (month);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employees_all" ON public.employees;
DROP POLICY IF EXISTS "salary_payments_all" ON public.salary_payments;

CREATE POLICY "employees_all" ON public.employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "salary_payments_all" ON public.salary_payments FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.employees TO anon, authenticated, service_role;
GRANT ALL ON public.salary_payments TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.employees_id_seq TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.salary_payments_id_seq TO anon, authenticated, service_role;
