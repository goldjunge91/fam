-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.shopping_category_preferences
  DROP CONSTRAINT shopping_category_preferences_category_id_check;

ALTER TABLE public.shopping_list_items
  DROP CONSTRAINT shopping_list_items_category_id_check;

ALTER TABLE public.shopping_category_preferences
  ADD CONSTRAINT shopping_category_preferences_category_id_check
    CHECK
    (category_id = ANY (ARRAY['produce'::text, 'bakery'::text, 'convenience'::text, 'breakfast'::text, 'hot_beverages'::text, 'pantry_staples'::text, 'cooking_baking'::text,
    'canned_sauces'::text,
    'snacks'::text,
    'beverages'::text,
    'drugstore'::text,
    'baby_kids'::text,
    'household'::text,
    'pet_supplies'::text,
    'meat_poultry'::text,
    'fish_seafood'::text,
    'deli_cold_cuts'::text,
    'plant_based'::text, 'dairy_eggs'::text, 'frozen'::text, 'checkout'::text, 'deli_meat'::text, 'pantry_canned'::text, 'pantry_dry'::text, 'dairy'::text]));

ALTER TABLE public.shopping_list_items
  ADD CONSTRAINT shopping_list_items_category_id_check
    CHECK
    (category_id = ANY (ARRAY['produce'::text, 'bakery'::text, 'convenience'::text, 'breakfast'::text, 'hot_beverages'::text, 'pantry_staples'::text, 'cooking_baking'::text,
    'canned_sauces'::text,
    'snacks'::text,
    'beverages'::text,
    'drugstore'::text,
    'baby_kids'::text,
    'household'::text,
    'pet_supplies'::text,
    'meat_poultry'::text,
    'fish_seafood'::text,
    'deli_cold_cuts'::text,
    'plant_based'::text, 'dairy_eggs'::text, 'frozen'::text, 'checkout'::text, 'deli_meat'::text, 'pantry_canned'::text, 'pantry_dry'::text, 'dairy'::text]));