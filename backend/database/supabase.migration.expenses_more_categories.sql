-- =============================================
-- Expenses: more categories (Food, Chai / Tea, Petrol / Fuel, ...)
-- Run once in Supabase SQL Editor. Existing rows are untouched.
-- =============================================

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_check CHECK (
  category IN (
    'Rent',
    'Salary',
    'Labour / Wages',
    'Electricity',
    'Water',
    'Transport',
    'Petrol / Fuel',
    'Food',
    'Chai / Tea',
    'Packaging',
    'Courier / Shipping',
    'Mobile & Internet',
    'Office Supplies',
    'Maintenance',
    'Repairs',
    'Marketing',
    'Cleaning Supplies',
    'Other'
  )
);
