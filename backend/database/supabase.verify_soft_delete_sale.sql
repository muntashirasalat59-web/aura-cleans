-- =============================================
-- VERIFY which delete functions exist + their bodies
-- Run in Supabase SQL Editor, then paste results if still hard-deleting
-- =============================================

-- 1) List every delete-related function signature
SELECT
  p.oid::regprocedure AS signature,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'soft_delete_sale',
    'hard_delete_sale',
    'delete_sale',
    'restore_sale_stock_for_delete'
  )
ORDER BY p.proname, args;

-- 2) Show FULL body of soft_delete_sale — must contain UPDATE, must NOT contain DELETE FROM sales
SELECT pg_get_functiondef('public.soft_delete_sale(bigint, uuid, text)'::regprocedure);

-- 3) Show body of delete_sale (hard-delete path — UI must NOT call this)
SELECT pg_get_functiondef('public.delete_sale(bigint)'::regprocedure);

-- 4) Quick smoke test (replace 999999 with a real active sale id, then ROLLBACK):
-- BEGIN;
-- SELECT public.soft_delete_sale(
--   999999,
--   (SELECT id FROM public.user_profiles LIMIT 1),
--   'Wrong entry / Mistake'
-- );
-- SELECT id, is_deleted, deleted_at, delete_reason FROM public.sales WHERE id = 999999;
-- ROLLBACK;
