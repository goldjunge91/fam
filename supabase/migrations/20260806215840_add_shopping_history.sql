-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

GRANT DELETE, INSERT, SELECT, UPDATE ON public.shopping_history TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.shopping_history TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.shopping_history TO service_role;