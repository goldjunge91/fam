-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

CREATE TABLE public.shopping_history (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  household_id  uuid                     NOT NULL,
  completed_by  uuid,
  completed_at  timestamp with time zone NOT NULL,
  item_name     text                     NOT NULL,
  quantity      numeric(10,3)            NOT NULL,
  unit          text                     NOT NULL,
  category      text,
  product_id    uuid,
  location_kind text,
  expiry_date   date,
  created_at    timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.shopping_history IS 'Historie abgeschlossener Einkäufe. Append-only, kein Offline-Sync-Flag.';

ALTER TABLE public.shopping_history
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shopping_history
  ADD CONSTRAINT shopping_history_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.shopping_history
  ADD CONSTRAINT shopping_history_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.shopping_history
  ADD CONSTRAINT shopping_history_location_kind_check CHECK (location_kind = ANY (ARRAY['fridge'::text, 'freezer'::text, 'pantry'::text]));

ALTER TABLE public.shopping_history
  ADD CONSTRAINT shopping_history_pkey PRIMARY KEY (id);

ALTER TABLE public.shopping_history
  ADD CONSTRAINT shopping_history_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.shopping_history TO anon;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.shopping_history TO authenticated;

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.shopping_history TO service_role;

CREATE INDEX shopping_history_household_id_idx ON public.shopping_history (household_id);

CREATE INDEX shopping_history_completed_at_idx ON public.shopping_history (household_id, completed_at);

CREATE POLICY shopping_history_all_member ON public.shopping_history
  TO authenticated
  USING (( SELECT private.is_household_member(shopping_history.household_id) AS is_household_member))
  WITH CHECK (( SELECT private.is_household_member(shopping_history.household_id) AS is_household_member));