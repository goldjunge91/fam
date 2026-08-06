-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.storage_locations
  DROP CONSTRAINT storage_locations_kind_check;

ALTER TABLE public.storage_locations
  ADD CONSTRAINT storage_locations_kind_check CHECK (kind = ANY (ARRAY['fridge'::text, 'freezer'::text, 'pantry'::text, 'custom'::text]));