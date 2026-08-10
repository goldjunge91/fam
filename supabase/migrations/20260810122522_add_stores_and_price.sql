-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.shopping_list_items
  ADD COLUMN store_id uuid;

ALTER TABLE public.shopping_list_items
  ADD COLUMN price_estimate numeric(10,2);

ALTER TABLE public.shopping_list_items
  ADD CONSTRAINT shopping_list_items_price_estimate_check CHECK (price_estimate >= 0::numeric);

CREATE INDEX shopping_list_items_store_id_idx ON public.shopping_list_items (store_id);

CREATE TABLE public.stores (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  household_id uuid                     NOT NULL,
  name         text                     NOT NULL,
  color        text                     DEFAULT '#6B7280'::text NOT NULL,
  sort_order   integer                  DEFAULT 0 NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at   timestamp with time zone
);

ALTER TABLE public.stores
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stores
  ADD CONSTRAINT stores_color_check CHECK (color ~* '^#[0-9a-f]{6}$'::text);

ALTER TABLE public.stores
  ADD CONSTRAINT stores_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.stores
  ADD CONSTRAINT stores_name_check CHECK (length(TRIM(BOTH FROM name)) >= 1 AND length(TRIM(BOTH FROM name)) <= 60);

ALTER TABLE public.stores
  ADD CONSTRAINT stores_pkey PRIMARY KEY (id);

ALTER TABLE public.shopping_list_items
  ADD CONSTRAINT shopping_list_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE SET NULL;

GRANT ALL ON public.stores TO anon;

GRANT ALL ON public.stores TO authenticated;

GRANT ALL ON public.stores TO service_role;

CREATE INDEX stores_household_updated_idx ON public.stores (household_id, updated_at);

CREATE INDEX stores_household_id_idx ON public.stores (household_id);

CREATE TRIGGER stores_set_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY stores_all_member ON public.stores
  TO authenticated
  USING (( SELECT private.is_household_member(stores.household_id) AS is_household_member))
  WITH CHECK (( SELECT private.is_household_member(stores.household_id) AS is_household_member));