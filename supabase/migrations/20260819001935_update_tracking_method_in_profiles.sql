-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.profiles
  DROP COLUMN module_cgm;

ALTER TABLE public.profiles
  DROP COLUMN module_fasting;

ALTER TABLE public.profiles
  DROP COLUMN module_glp1;

ALTER TABLE public.profiles
  DROP COLUMN module_keto;

ALTER TABLE public.profiles
  DROP COLUMN module_volumetrics;

ALTER TABLE public.profiles
  DROP COLUMN module_workouts;

ALTER TABLE public.profiles
  ADD COLUMN tracking_method text DEFAULT 'standard'::text NOT NULL;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tracking_method_check
    CHECK (tracking_method = ANY (ARRAY['standard'::text, 'glp1'::text, 'fasting'::text, 'keto'::text, 'workouts'::text, 'cgm'::text, 'volumetrics'::text]));