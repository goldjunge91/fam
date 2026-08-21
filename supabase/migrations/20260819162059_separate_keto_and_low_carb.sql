-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_tracking_method_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tracking_method_check
    CHECK (tracking_method = ANY (ARRAY['standard'::text, 'glp1'::text, 'fasting'::text, 'keto'::text, 'low_carb'::text, 'workouts'::text, 'cgm'::text, 'volumetrics'::text]));