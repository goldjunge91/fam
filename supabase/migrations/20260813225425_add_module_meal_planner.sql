-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.profiles
  ADD COLUMN module_meal_planner boolean DEFAULT true NOT NULL;