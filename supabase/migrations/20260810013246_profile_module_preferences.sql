-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.profiles
  ADD COLUMN module_fridge boolean DEFAULT true NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN module_shopping_list boolean DEFAULT true NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN module_calories boolean DEFAULT true NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN module_recipes boolean DEFAULT true NOT NULL;