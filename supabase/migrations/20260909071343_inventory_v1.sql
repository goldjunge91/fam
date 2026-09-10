SET local check_function_bodies = off;

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "service_role";

REVOKE ALL ON FUNCTION "public"."apply_plus_household_event"(uuid, uuid, boolean, timestamp WITH time zone, bigint, text) FROM "anon";

REVOKE ALL ON FUNCTION "public"."apply_plus_household_event"(uuid, uuid, boolean, timestamp WITH time zone, bigint, text) FROM "authenticated";

REVOKE ALL ON FUNCTION "public"."assign_ai_household"(uuid, uuid, timestamp WITH time zone, bigint, text) FROM "anon";

REVOKE ALL ON FUNCTION "public"."assign_ai_household"(uuid, uuid, timestamp WITH time zone, bigint, text) FROM "authenticated";

REVOKE ALL ON FUNCTION "public"."book_ai_credit"(uuid, text, uuid, integer) FROM "anon";

REVOKE ALL ON FUNCTION "public"."book_ai_credit"(uuid, text, uuid, integer) FROM "authenticated";

REVOKE ALL ON FUNCTION "public"."create_household"(text) FROM "anon";

REVOKE ALL ON FUNCTION "public"."deactivate_ai_household"(uuid, bigint, text) FROM "anon";

REVOKE ALL ON FUNCTION "public"."deactivate_ai_household"(uuid, bigint, text) FROM "authenticated";

REVOKE ALL ON FUNCTION "public"."get_ai_credit_status"(uuid, integer) FROM "anon";

REVOKE ALL ON FUNCTION "public"."get_ai_credit_status"(uuid, integer) FROM "authenticated";

REVOKE ALL ON FUNCTION "public"."household_member_profiles"(uuid) FROM "anon";

REVOKE ALL ON FUNCTION "public"."prepare_account_deletion"() FROM "anon";

REVOKE ALL ON FUNCTION "public"."redeem_invite"(uuid) FROM "anon";

REVOKE ALL ON TABLE "public"."ai_credit_bookings" FROM "anon";

REVOKE ALL ON TABLE "public"."ai_credit_bookings" FROM "authenticated";

REVOKE ALL ON TABLE "public"."feedback_messages" FROM "anon";

REVOKE ALL ON TABLE "public"."feedback_tickets" FROM "anon";

REVOKE ALL ON TABLE "public"."profile_food_rules" FROM "anon";

REVOKE ALL ON TABLE "public"."revenuecat_ai_assignments" FROM "anon";

REVOKE ALL ON TABLE "public"."revenuecat_ai_assignments" FROM "authenticated";

REVOKE ALL ON TABLE "public"."revenuecat_plus_assignments" FROM "anon";

REVOKE ALL ON TABLE "public"."revenuecat_plus_assignments" FROM "authenticated";

REVOKE ALL ON TABLE "public"."revenuecat_processed_events" FROM "anon";

REVOKE ALL ON TABLE "public"."revenuecat_processed_events" FROM "authenticated";

REVOKE ALL ON TABLE "public"."shopping_category_feedback_events" FROM "anon";

REVOKE ALL ON TABLE "public"."shopping_category_preferences" FROM "anon";

DROP POLICY "fridge_items_all_member" ON "public"."fridge_items";

DROP POLICY "shopping_history_all_member" ON "public"."shopping_history";

DROP POLICY "shopping_list_items_all_member" ON "public"."shopping_list_items";

DROP POLICY "stores_all_member" ON "public"."stores";

DROP POLICY "recipe_covers_select" ON "storage"."objects";

DROP POLICY "recipe_step_images_insert" ON "storage"."objects";

DROP POLICY "recipe_step_images_select" ON "storage"."objects";

ALTER TABLE "public"."fridge_items"
  DROP CONSTRAINT "fridge_items_location_id_fkey";

ALTER TABLE "public"."fridge_items"
  DROP CONSTRAINT "fridge_items_package_size_check";

ALTER TABLE "public"."fridge_items"
  DROP CONSTRAINT "fridge_items_package_size_complete";

ALTER TABLE "public"."fridge_items"
  DROP CONSTRAINT "fridge_items_package_size_unit_check";

ALTER TABLE "public"."fridge_items"
  DROP CONSTRAINT "fridge_items_quantity_check";

ALTER TABLE "public"."fridge_items"
  DROP CONSTRAINT "fridge_items_unit_check";

ALTER TABLE "public"."shopping_history"
  DROP CONSTRAINT "shopping_history_category_id_check";

CREATE TABLE "public"."transactions" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "household_id"   uuid                     NOT NULL,
  "fridge_item_id" uuid                     NOT NULL,
  "product_id"     uuid,
  "actor"          uuid,
  "type"           text                     NOT NULL,
  "quantity"       numeric(10,1)            NOT NULL,
  "unit"           text                     NOT NULL DEFAULT 'piece'::text,
  "location_id"    uuid                     NOT NULL,
  "reason"         text,
  "notes"          text,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "operation_id"   uuid                     NOT NULL,
  "reversal_of"    uuid,
  CONSTRAINT "transactions_notes_check" CHECK (((notes IS NULL) OR (length(notes) <= 500))),
  CONSTRAINT "transactions_pkey" PRIMARY KEY (id),
  CONSTRAINT "transactions_quantity_check" CHECK (((quantity >= 0.1) AND (quantity <= 9999999.9))),
  CONSTRAINT "transactions_reason_check" CHECK ((((type <> 'waste'::text) AND (reason IS NULL)) OR ((type = 'waste'::text) AND (reason IS
    NOT NULL) AND (reason = ANY (ARRAY['expired'::text, 'spoiled'::text, 'other'::text]))))),
  CONSTRAINT "transactions_type_check" CHECK ((type = ANY (ARRAY['in'::text, 'out'::text, 'waste'::text]))),
  CONSTRAINT "transactions_unit_check" CHECK ((length(TRIM(BOTH FROM unit)) > 0))
);

ALTER TABLE "public"."transactions"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."transactions"
  REPLICA IDENTITY FULL;

ALTER TABLE "public"."fridge_items"
  ADD COLUMN "opened_at" timestamp WITH time zone;

ALTER TABLE "public"."fridge_items"
  ADD COLUMN "vacuum_sealed" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."fridge_items"
  ADD COLUMN "expiry_user_set" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."fridge_items"
  ALTER COLUMN "location_id" SET NOT NULL;

ALTER TABLE "public"."fridge_items"
  ALTER COLUMN "package_size" DROP DEFAULT;

ALTER TABLE "public"."fridge_items"
  ALTER COLUMN "package_size" TYPE numeric(10,1) USING "package_size"::numeric(10,1);

ALTER TABLE "public"."fridge_items"
  ALTER COLUMN "quantity" DROP DEFAULT;

ALTER TABLE "public"."fridge_items"
  ALTER COLUMN "quantity" TYPE numeric(10,1) USING "quantity"::numeric(10,1);

ALTER TABLE "public"."fridge_items"
  ALTER COLUMN "quantity" SET DEFAULT 1.0;

ALTER TABLE "public"."fridge_items"
  ALTER COLUMN "quantity" SET DEFAULT 1.0;

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
    (new_id, 'Tiefkühltruhe', 'freezer', 1),
    (new_id, 'Abstellkammer', 'pantry', 2);

  return new_id;
end;
$function$;

ALTER TABLE "public"."fridge_items"
  ADD CONSTRAINT "fridge_items_location_id_fkey" FOREIGN KEY (location_id) REFERENCES public.storage_locations(id) ON DELETE RESTRICT;

ALTER TABLE "public"."fridge_items"
  ADD CONSTRAINT "fridge_items_package_pair_check" CHECK (((package_size IS NULL) = (package_size_unit IS NULL)));

ALTER TABLE "public"."fridge_items"
  ADD CONSTRAINT "fridge_items_package_size_check" CHECK (((package_size IS NULL) OR ((package_size >= 0.1) AND (package_size <= 9999999.9))));

ALTER TABLE "public"."fridge_items"
  ADD CONSTRAINT "fridge_items_package_size_unit_check" CHECK (((package_size_unit IS NULL) OR (length(TRIM(BOTH FROM package_size_unit)) > 0)));

ALTER TABLE "public"."fridge_items"
  ADD CONSTRAINT "fridge_items_quantity_check" CHECK (((quantity >= 0.0) AND (quantity <= 9999999.9)));

ALTER TABLE "public"."fridge_items"
  ADD CONSTRAINT "fridge_items_quantity_lifecycle_check" CHECK ((((deleted_at IS NULL) AND (quantity > 0.0)) OR ((deleted_at IS NOT NULL) AND (quantity = 0.0))));

ALTER TABLE "public"."fridge_items"
  ADD CONSTRAINT "fridge_items_unit_check" CHECK ((length(TRIM(BOTH FROM unit)) > 0));

ALTER TABLE "public"."shopping_history"
  ADD CONSTRAINT "shopping_history_category_id_check"
    CHECK
    ((category_id = ANY (ARRAY['fresh_produce'::text, 'bakery'::text, 'chilled_dairy_eggs'::text, 'ambient_milk_drinks'::text, 'chilled_plant_based'::text, 'meat_poultry'::text,
    'fish_seafood'::text,
    'deli'::text,
    'pasta_tomato'::text,
    'rice_world_foods'::text,
    'breakfast'::text,
    'baking'::text,
    'oils_spices'::text,
    'condiments'::text,
    'canned_jars'::text,
    'ready_meals'::text,
    'snacks'::text,
    'sweets'::text,
    'cold_drinks'::text,
    'hot_drinks'::text,
    'alcohol'::text,
    'frozen'::text,
    'baby'::text,
    'pets'::text,
    'household'::text,
    'personal_care'::text,
    'other'::text,
    'produce'::text,
    'deli_meat'::text,
    'pantry_canned'::text,
    'pantry_dry'::text,
    'convenience'::text,
    'hot_beverages'::text,
    'pantry_staples'::text,
    'cooking_baking'::text,
    'canned_sauces'::text,
    'beverages'::text, 'drugstore'::text, 'baby_kids'::text, 'deli_cold_cuts'::text, 'plant_based'::text, 'dairy_eggs'::text, 'dairy'::text, 'checkout'::text])));

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_actor_fkey" FOREIGN KEY (actor) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_fridge_item_id_fkey" FOREIGN KEY (fridge_item_id) REFERENCES public.fridge_items(id) ON DELETE RESTRICT;

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_household_id_fkey" FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_location_id_fkey" FOREIGN KEY (location_id) REFERENCES public.storage_locations(id) ON DELETE RESTRICT;

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_reversal_of_fkey" FOREIGN KEY (reversal_of) REFERENCES public.transactions(id) ON DELETE RESTRICT;

CREATE INDEX transactions_fridge_item_id_idx ON public.transactions USING btree (fridge_item_id);

CREATE INDEX transactions_household_created_idx ON public.transactions USING btree (household_id, created_at);

CREATE INDEX transactions_household_id_idx ON public.transactions USING btree (household_id);

CREATE UNIQUE INDEX transactions_operation_type_idx ON public.transactions USING btree (operation_id, TYPE);

CREATE UNIQUE INDEX transactions_reversal_of_idx ON public.transactions USING btree (reversal_of)
  WHERE (reversal_of IS NOT NULL);

CREATE POLICY "fridge_items_all_member" ON "public"."fridge_items"
  FOR ALL
  TO "authenticated"
  USING (( SELECT private.is_household_member(fridge_items.household_id) AS is_household_member))
  WITH CHECK ((( SELECT private.is_household_member(fridge_items.household_id) AS is_household_member) AND (EXISTS ( SELECT 1
   FROM public.storage_locations
  WHERE ((storage_locations.id = fridge_items.location_id) AND (storage_locations.household_id = fridge_items.household_id))))));

CREATE POLICY "shopping_history_all_member" ON "public"."shopping_history"
  FOR ALL
  TO "authenticated"
  USING (private.is_household_member(household_id))
  WITH CHECK (private.is_household_member(household_id));

CREATE POLICY "shopping_list_items_all_member" ON "public"."shopping_list_items"
  FOR ALL
  TO "authenticated"
  USING (private.is_household_member(household_id))
  WITH CHECK (private.is_household_member(household_id));

CREATE POLICY "stores_all_member" ON "public"."stores"
  FOR ALL
  TO "authenticated"
  USING (private.is_household_member(household_id))
  WITH CHECK (private.is_household_member(household_id));

CREATE POLICY "transactions_select_member" ON "public"."transactions"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT private.is_household_member(transactions.household_id) AS is_household_member));

CREATE POLICY "recipe_covers_select" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'recipe-covers'::text) AND
CASE
    WHEN ((storage.foldername(name))[1] = ANY (ARRAY['templates'::text, 'catalog'::text])) THEN true
    ELSE ( SELECT private.is_household_member(((storage.foldername(objects.name))[1])::uuid) AS is_household_member)
END));

CREATE POLICY "recipe_step_images_insert" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH
    CHECK
    (((bucket_id = 'recipe-step-images'::text) AND (((storage.foldername(name))[1] = 'catalog'::text) OR ( SELECT
    private.is_household_member(((storage.foldername(objects.name))[1])::uuid) AS is_household_member))));

CREATE POLICY "recipe_step_images_select" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING
    (((bucket_id = 'recipe-step-images'::text) AND (((storage.foldername(name))[1] = 'catalog'::text) OR ( SELECT
    private.is_household_member(((storage.foldername(objects.name))[1])::uuid) AS is_household_member))));

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."transactions";

COMMENT ON TABLE "public"."fridge_items" IS 'Geteilter Haushaltsbestand. Soft-Delete ueber deleted_at wegen Offline-Sync.';

COMMENT ON TABLE "public"."storage_locations" IS 'Geteilte Lagerorte eines Haushalts. Soft-Delete ueber deleted_at fuer Offline-Sync.';

COMMENT ON TABLE "public"."transactions" IS 'Unveraenderliches Bewegungsjournal fuer den Haushaltsbestand.';

REVOKE ALL ON TABLE "public"."ai_credit_bookings" FROM "service_role";

GRANT INSERT, SELECT ON TABLE "public"."ai_credit_bookings" TO "service_role";

REVOKE ALL ON TABLE "public"."feedback_messages" FROM "authenticated";

GRANT INSERT, SELECT ON TABLE "public"."feedback_messages" TO "authenticated";

REVOKE ALL ON TABLE "public"."feedback_tickets" FROM "authenticated";

GRANT INSERT, SELECT ON TABLE "public"."feedback_tickets" TO "authenticated";

REVOKE ALL ON TABLE "public"."profile_food_rules" FROM "authenticated";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."profile_food_rules" TO "authenticated";

REVOKE ALL ON TABLE "public"."revenuecat_processed_events" FROM "service_role";

GRANT INSERT, SELECT ON TABLE "public"."revenuecat_processed_events" TO "service_role";

REVOKE ALL ON TABLE "public"."shopping_category_feedback_events" FROM "authenticated";

GRANT INSERT ON TABLE "public"."shopping_category_feedback_events" TO "authenticated";

REVOKE ALL ON TABLE "public"."shopping_category_feedback_events" FROM "service_role";

GRANT SELECT ON TABLE "public"."shopping_category_feedback_events" TO "service_role";

REVOKE ALL ON TABLE "public"."shopping_category_preferences" FROM "authenticated";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."shopping_category_preferences" TO "authenticated";

GRANT INSERT, SELECT ON TABLE "public"."transactions" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."transactions" TO "postgres";

GRANT INSERT, SELECT ON TABLE "public"."transactions" TO "service_role";
