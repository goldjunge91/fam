-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

CREATE OR REPLACE FUNCTION public.create_household (
  household_name text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  new_id uuid;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Nicht angemeldet';
  end if;

  insert into public.households (name, created_by)
  values (household_name, uid)
  returning id into new_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_id, uid, 'admin');

  insert into public.storage_locations (household_id, name, kind, sort_order)
  values
    (new_id, 'Kühlschrank', 'fridge', 0),
    (new_id, 'Gefrierfach', 'freezer', 1),
    (new_id, 'Vorratsschrank', 'pantry', 2);

  return new_id;
end;
$function$;

CREATE TABLE public.fridge_items (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  household_id uuid                     NOT NULL,
  location_id  uuid,
  product_id   uuid,
  name         text                     NOT NULL,
  quantity     numeric(10,3)            DEFAULT 1 NOT NULL,
  unit         text                     DEFAULT 'piece'::text NOT NULL,
  expiry_date  date,
  added_by     uuid,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at   timestamp with time zone
);

COMMENT ON TABLE public.fridge_items IS 'Geteilter Haushaltsbestand. Soft-Delete ueber deleted_at wegen Offline-Sync (#42).';

ALTER TABLE public.fridge_items
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fridge_items
  ADD CONSTRAINT fridge_items_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.fridge_items
  ADD CONSTRAINT fridge_items_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.fridge_items
  ADD CONSTRAINT fridge_items_name_check CHECK (length(TRIM(BOTH FROM name)) >= 1 AND length(TRIM(BOTH FROM name)) <= 200);

ALTER TABLE public.fridge_items
  ADD CONSTRAINT fridge_items_pkey PRIMARY KEY (id);

ALTER TABLE public.fridge_items
  ADD CONSTRAINT fridge_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.fridge_items
  ADD CONSTRAINT fridge_items_quantity_check CHECK (quantity >= 0::numeric);

ALTER TABLE public.fridge_items
  ADD CONSTRAINT fridge_items_unit_check CHECK (unit = ANY (ARRAY['g'::text, 'kg'::text, 'ml'::text, 'l'::text, 'piece'::text, 'package'::text, 'portion'::text]));

GRANT ALL ON public.fridge_items TO anon;

GRANT ALL ON public.fridge_items TO authenticated;

GRANT ALL ON public.fridge_items TO service_role;

CREATE INDEX fridge_items_product_id_idx ON public.fridge_items (product_id);

CREATE INDEX fridge_items_household_updated_idx ON public.fridge_items (household_id, updated_at);

CREATE INDEX fridge_items_household_id_idx ON public.fridge_items (household_id);

CREATE INDEX fridge_items_expiry_idx ON public.fridge_items (household_id, expiry_date)
  WHERE deleted_at IS NULL AND expiry_date IS NOT NULL;

CREATE INDEX fridge_items_location_id_idx ON public.fridge_items (location_id);

CREATE INDEX fridge_items_added_by_idx ON public.fridge_items (added_by);

CREATE TRIGGER fridge_items_set_updated_at
  BEFORE UPDATE ON public.fridge_items
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY fridge_items_all_member ON public.fridge_items
  TO authenticated
  USING (( SELECT private.is_household_member(fridge_items.household_id) AS is_household_member))
  WITH CHECK (( SELECT private.is_household_member(fridge_items.household_id) AS is_household_member));

CREATE TABLE public.shopping_list_items (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  household_id uuid                     NOT NULL,
  product_id   uuid,
  name         text                     NOT NULL,
  quantity     numeric(10,3)            DEFAULT 1 NOT NULL,
  unit         text                     DEFAULT 'piece'::text NOT NULL,
  category     text,
  sort_index   integer                  DEFAULT 0 NOT NULL,
  checked_at   timestamp with time zone,
  checked_by   uuid,
  added_by     uuid,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at   timestamp with time zone
);

COMMENT ON TABLE public.shopping_list_items IS 'Geteilte Einkaufsliste. checked_at als Zeitstempel, damit der Einkaufsabschluss rekonstruierbar bleibt.';

ALTER TABLE public.shopping_list_items
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shopping_list_items
  ADD CONSTRAINT shopping_list_items_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.shopping_list_items
  ADD CONSTRAINT shopping_list_items_checked_by_fkey FOREIGN KEY (checked_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.shopping_list_items
  ADD CONSTRAINT shopping_list_items_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.shopping_list_items
  ADD CONSTRAINT shopping_list_items_name_check CHECK (length(TRIM(BOTH FROM name)) >= 1 AND length(TRIM(BOTH FROM name)) <= 200);

ALTER TABLE public.shopping_list_items
  ADD CONSTRAINT shopping_list_items_pkey PRIMARY KEY (id);

ALTER TABLE public.shopping_list_items
  ADD CONSTRAINT shopping_list_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.shopping_list_items
  ADD CONSTRAINT shopping_list_items_quantity_check CHECK (quantity >= 0::numeric);

ALTER TABLE public.shopping_list_items
  ADD CONSTRAINT shopping_list_items_unit_check CHECK (unit = ANY (ARRAY['g'::text, 'kg'::text, 'ml'::text, 'l'::text, 'piece'::text, 'package'::text, 'portion'::text]));

GRANT ALL ON public.shopping_list_items TO anon;

GRANT ALL ON public.shopping_list_items TO authenticated;

GRANT ALL ON public.shopping_list_items TO service_role;

CREATE INDEX shopping_list_items_added_by_idx ON public.shopping_list_items (added_by);

CREATE INDEX shopping_list_items_household_id_idx ON public.shopping_list_items (household_id);

CREATE INDEX shopping_list_items_checked_by_idx ON public.shopping_list_items (checked_by);

CREATE INDEX shopping_list_items_product_id_idx ON public.shopping_list_items (product_id);

CREATE INDEX shopping_list_items_household_updated_idx ON public.shopping_list_items (household_id, updated_at);

CREATE TRIGGER shopping_list_items_set_updated_at
  BEFORE UPDATE ON public.shopping_list_items
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY shopping_list_items_all_member ON public.shopping_list_items
  TO authenticated
  USING (( SELECT private.is_household_member(shopping_list_items.household_id) AS is_household_member))
  WITH CHECK (( SELECT private.is_household_member(shopping_list_items.household_id) AS is_household_member));

CREATE TABLE public.storage_locations (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  household_id uuid                     NOT NULL,
  name         text                     NOT NULL,
  kind         text                     NOT NULL,
  sort_order   integer                  DEFAULT 0 NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.storage_locations
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.storage_locations
  ADD CONSTRAINT storage_locations_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.storage_locations
  ADD CONSTRAINT storage_locations_kind_check CHECK (kind = ANY (ARRAY['fridge'::text, 'freezer'::text, 'pantry'::text]));

ALTER TABLE public.storage_locations
  ADD CONSTRAINT storage_locations_name_check CHECK (length(TRIM(BOTH FROM name)) >= 1 AND length(TRIM(BOTH FROM name)) <= 60);

ALTER TABLE public.storage_locations
  ADD CONSTRAINT storage_locations_pkey PRIMARY KEY (id);

ALTER TABLE public.fridge_items
  ADD CONSTRAINT fridge_items_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.storage_locations(id) ON DELETE SET NULL;

GRANT ALL ON public.storage_locations TO anon;

GRANT ALL ON public.storage_locations TO authenticated;

GRANT ALL ON public.storage_locations TO service_role;

CREATE INDEX storage_locations_household_id_idx ON public.storage_locations (household_id);

CREATE TRIGGER storage_locations_set_updated_at
  BEFORE UPDATE ON public.storage_locations
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY storage_locations_all_member ON public.storage_locations
  TO authenticated
  USING (( SELECT private.is_household_member(storage_locations.household_id) AS is_household_member))
  WITH CHECK (( SELECT private.is_household_member(storage_locations.household_id) AS is_household_member));