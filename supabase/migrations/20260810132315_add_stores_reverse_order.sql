-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.stores
  ADD COLUMN reverse_order boolean DEFAULT false NOT NULL;