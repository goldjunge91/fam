-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.meal_plan_entries
  DROP CONSTRAINT meal_plan_entries_meal_slot_check;

ALTER TABLE public.meal_plan_entries
  ADD CONSTRAINT meal_plan_entries_meal_slot_check CHECK (meal_slot = ANY (ARRAY['breakfast'::text, 'lunch'::text, 'dinner'::text]));