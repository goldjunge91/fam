-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.weight_entries
  ADD COLUMN measured_at timestamp with time zone;

CREATE INDEX weight_entries_user_profile_measured_idx ON public.weight_entries (user_id, child_profile_id, measured_at)
  WHERE deleted_at IS NULL AND measured_at IS NOT NULL;