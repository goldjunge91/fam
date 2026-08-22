-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.shopping_category_preferences
  DROP CONSTRAINT shopping_category_preferences_check;

ALTER TABLE public.shopping_category_preferences
  ADD CONSTRAINT shopping_category_preferences_normalized_key_check CHECK (normalized_key_value <> ''::text);

REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.shopping_category_preferences FROM anon;

REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.shopping_category_preferences FROM authenticated;
