-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER POLICY products_insert_own ON public.products WITH
  CHECK (((( SELECT auth.uid() AS uid) = created_by) AND (off_category_tags = '{}'::text[]) AND (off_last_modified_at IS NULL)));