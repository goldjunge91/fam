-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.profiles
  ADD COLUMN onboarding_completed_at timestamp with time zone;