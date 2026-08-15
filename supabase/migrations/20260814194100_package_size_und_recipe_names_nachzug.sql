-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

-- Vorbestehende Schema-Drift ohne generierte Migration (package_size seit
-- Commit c94d3e1, recipe_names seit der Rezept-Uebernahme in die
-- Einkaufsliste) — mit ausgeliefert, weil `db:diff` sie zusammen mit den
-- Premium-Spalten unten als eine Differenz gemeldet hat. Inhaltlich
-- unabhaengig von den households-Aenderungen, deshalb eigene Migration statt
-- vermischt in "household_premium_columns".

ALTER TABLE public.fridge_items
  ADD COLUMN package_size numeric(10,3);

ALTER TABLE public.fridge_items
  ADD CONSTRAINT fridge_items_package_size_check CHECK (package_size > 0::numeric);

ALTER TABLE public.fridge_items
  ADD COLUMN package_size_unit text;

ALTER TABLE public.fridge_items
  ADD CONSTRAINT fridge_items_package_size_complete CHECK ((package_size IS NULL) = (package_size_unit IS NULL));

ALTER TABLE public.fridge_items
  ADD CONSTRAINT fridge_items_package_size_unit_check CHECK (package_size_unit = ANY (ARRAY['g'::text, 'kg'::text, 'ml'::text, 'l'::text, 'piece'::text, 'portion'::text]));

ALTER TABLE public.shopping_list_items
  ADD COLUMN recipe_names text[] DEFAULT '{}'::text[] NOT NULL;

ALTER TABLE public.shopping_list_items
  ADD COLUMN package_size numeric(10,3);

ALTER TABLE public.shopping_list_items
  ADD CONSTRAINT shopping_list_items_package_size_check CHECK (package_size > 0::numeric);

ALTER TABLE public.shopping_list_items
  ADD COLUMN package_size_unit text;

ALTER TABLE public.shopping_list_items
  ADD CONSTRAINT shopping_list_items_package_size_complete CHECK ((package_size IS NULL) = (package_size_unit IS NULL));

ALTER TABLE public.shopping_list_items
  ADD CONSTRAINT shopping_list_items_package_size_unit_check CHECK (package_size_unit = ANY (ARRAY['g'::text, 'kg'::text, 'ml'::text, 'l'::text, 'piece'::text, 'portion'::text]));

ALTER TABLE public.stores
  ADD COLUMN package_size numeric(10,3);

ALTER TABLE public.stores
  ADD CONSTRAINT stores_package_size_check CHECK (package_size > 0::numeric);

ALTER TABLE public.stores
  ADD COLUMN package_size_unit text;

ALTER TABLE public.stores
  ADD CONSTRAINT shopping_list_items_package_size_complete CHECK ((package_size IS NULL) = (package_size_unit IS NULL));

ALTER TABLE public.stores
  ADD CONSTRAINT stores_package_size_unit_check CHECK (package_size_unit = ANY (ARRAY['g'::text, 'kg'::text, 'ml'::text, 'l'::text, 'piece'::text, 'portion'::text]));
