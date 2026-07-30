-- =============================================
-- Step 1: Tables, indexes, RLS, grants
-- Supabase Dashboard → SQL Editor → Run this file first
-- =============================================

CREATE TABLE IF NOT EXISTS public.products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  supplier TEXT NOT NULL DEFAULT '',
  unit_type TEXT NOT NULL DEFAULT 'Piece' CHECK (unit_type IN ('ML', 'L', 'KG', 'Gram', 'Piece', 'Box', 'Dozen')),
  unit_size NUMERIC(12, 2) NOT NULL DEFAULT 1,
  sku TEXT,
  description TEXT NOT NULL DEFAULT '',
  fragrance TEXT NOT NULL DEFAULT 'Unscented',
  hsn_sac TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_unique
  ON public.products (sku)
  WHERE sku IS NOT NULL AND sku <> '';

CREATE TABLE IF NOT EXISTS public.parties (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('retailer', 'wholesaler', 'manufacturer')),
  contact TEXT DEFAULT '',
  address TEXT DEFAULT '',
  gst_number TEXT DEFAULT '',
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchases (
  id BIGSERIAL PRIMARY KEY,
  party_id BIGINT NOT NULL REFERENCES public.parties (id),
  purchase_date DATE NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  gst_percent NUMERIC(5, 2) NOT NULL DEFAULT 18,
  gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_items (
  id BIGSERIAL PRIMARY KEY,
  purchase_id BIGINT NOT NULL REFERENCES public.purchases (id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES public.products (id),
  quantity INTEGER NOT NULL,
  rate NUMERIC(12, 2) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sales (
  id BIGSERIAL PRIMARY KEY,
  party_id BIGINT NOT NULL REFERENCES public.parties (id),
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_date DATE NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  gst_percent NUMERIC(5, 2) NOT NULL DEFAULT 18,
  gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id BIGSERIAL PRIMARY KEY,
  sale_id BIGINT NOT NULL REFERENCES public.sales (id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES public.products (id),
  quantity INTEGER NOT NULL,
  rate NUMERIC(12, 2) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchases_party_id ON public.purchases (party_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON public.purchases (purchase_date);
CREATE INDEX IF NOT EXISTS idx_sales_party_id ON public.sales (party_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_date ON public.sales (invoice_date);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON public.purchase_items (product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON public.sale_items (product_id);

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

CREATE TABLE IF NOT EXISTS public.salary_payments (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  paid_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, month)
);

CREATE INDEX IF NOT EXISTS idx_salary_payments_month ON public.salary_payments (month);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_all" ON public.products;
DROP POLICY IF EXISTS "parties_all" ON public.parties;
DROP POLICY IF EXISTS "purchases_all" ON public.purchases;
DROP POLICY IF EXISTS "purchase_items_all" ON public.purchase_items;
DROP POLICY IF EXISTS "sales_all" ON public.sales;
DROP POLICY IF EXISTS "sale_items_all" ON public.sale_items;
DROP POLICY IF EXISTS "expenses_all" ON public.expenses;
DROP POLICY IF EXISTS "employees_all" ON public.employees;
DROP POLICY IF EXISTS "salary_payments_all" ON public.salary_payments;

CREATE POLICY "products_all" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "parties_all" ON public.parties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "purchases_all" ON public.purchases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "purchase_items_all" ON public.purchase_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "sales_all" ON public.sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "sale_items_all" ON public.sale_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "expenses_all" ON public.expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "employees_all" ON public.employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "salary_payments_all" ON public.salary_payments FOR ALL USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
CREATE POLICY "user_profiles_select_own" ON public.user_profiles FOR SELECT USING (auth.uid() = id);
