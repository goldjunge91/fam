-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.stores
  DROP COLUMN reverse_order;

ALTER TABLE public.stores
  ADD COLUMN category_order text;