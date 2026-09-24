SET local check_function_bodies = off;

CREATE TABLE "public"."receipt_assets" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "receipt_id"   uuid                     NOT NULL,
  "household_id" uuid                     NOT NULL,
  "storage_path" text                     NOT NULL,
  "mime_type"    text                     NOT NULL,
  "byte_size"    bigint                   NOT NULL,
  "sort_order"   integer                  NOT NULL DEFAULT 0,
  "created_by"   uuid                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at"   timestamp with time zone,
  CONSTRAINT "receipt_assets_byte_size_check" CHECK (((byte_size > 0) AND (byte_size <= 5242880))),
  CONSTRAINT "receipt_assets_mime_type_check" CHECK ((mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text]))),
  CONSTRAINT "receipt_assets_pkey" PRIMARY KEY (id),
  CONSTRAINT "receipt_assets_sort_order_check" CHECK ((sort_order >= 0)),
  CONSTRAINT "receipt_assets_storage_path_key" UNIQUE (storage_path),
  CONSTRAINT "receipt_assets_storage_path_shape"
    CHECK
    ((((mime_type = 'image/jpeg'::text) AND ((storage_path = ((((((household_id)::text || '/'::text) || (receipt_id)::text) || '/'::text) || (id)::text) || '.jpg'::text)) OR
    (storage_path = ((((((household_id)::text || '/'::text) || (receipt_id)::text) || '/'::text) || (id)::text) || '.jpeg'::text)))) OR
    ((mime_type = 'image/png'::text) AND (storage_path = ((((((household_id)::text || '/'::text) || (receipt_id)::text) || '/'::text) || (id)::text) || '.png'::text))) OR
    ((mime_type = 'image/webp'::text) AND (storage_path = ((((((household_id)::text || '/'::text) || (receipt_id)::text) || '/'::text) || (id)::text) || '.webp'::text)))))
);

ALTER TABLE "public"."receipt_assets"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."receipt_items" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "receipt_id"        uuid                     NOT NULL,
  "household_id"      uuid                     NOT NULL,
  "position"          integer                  NOT NULL,
  "name"              text                     NOT NULL,
  "product_id"        uuid,
  "category_id"       text,
  "quantity"          numeric(10,3),
  "unit"              text,
  "package_size"      numeric(10,3),
  "package_size_unit" text,
  "line_total_cents"  bigint,
  "review_status"     text                     NOT NULL DEFAULT 'needs_review'::text,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at"        timestamp with time zone,
  CONSTRAINT "receipt_items_category_id_check"
    CHECK
    (((category_id IS NULL) OR (category_id = ANY (ARRAY['fresh_produce'::text, 'bakery'::text, 'chilled_dairy_eggs'::text, 'ambient_milk_drinks'::text,
    'chilled_plant_based'::text,
    'meat_poultry'::text,
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
    'convenience'::text,
    'hot_beverages'::text,
    'pantry_staples'::text,
    'cooking_baking'::text,
    'canned_sauces'::text,
    'beverages'::text,
    'drugstore'::text,
    'baby_kids'::text,
    'pet_supplies'::text,
    'deli_cold_cuts'::text, 'plant_based'::text, 'dairy_eggs'::text, 'checkout'::text, 'deli_meat'::text, 'pantry_canned'::text, 'pantry_dry'::text, 'dairy'::text])))),
  CONSTRAINT "receipt_items_line_total_cents_check" CHECK ((line_total_cents >= 0)),
  CONSTRAINT "receipt_items_name_check" CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 200))),
  CONSTRAINT "receipt_items_package_size_check" CHECK (((package_size IS NULL) OR (package_size > (0)::numeric))),
  CONSTRAINT "receipt_items_package_size_complete" CHECK (((package_size IS NULL) = (package_size_unit IS NULL))),
  CONSTRAINT "receipt_items_package_size_unit_check"
    CHECK (((package_size_unit IS NULL) OR (package_size_unit = ANY (ARRAY['g'::text, 'kg'::text, 'ml'::text, 'l'::text, 'piece'::text, 'portion'::text])))),
  CONSTRAINT "receipt_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "receipt_items_position_check" CHECK (("position" >= 0)),
  CONSTRAINT "receipt_items_quantity_check" CHECK (((quantity IS NULL) OR (quantity > (0)::numeric))),
  CONSTRAINT "receipt_items_review_status_check" CHECK ((review_status = ANY (ARRAY['needs_review'::text, 'confirmed'::text]))),
  CONSTRAINT "receipt_items_unit_check"
    CHECK (((unit IS NULL) OR (unit = ANY (ARRAY['g'::text, 'kg'::text, 'ml'::text, 'l'::text, 'piece'::text, 'package'::text, 'portion'::text]))))
);

ALTER TABLE "public"."receipt_items"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."receipts" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "household_id"      uuid                     NOT NULL,
  "store_id"          uuid,
  "purchase_date"     date,
  "currency"          text                     NOT NULL DEFAULT 'EUR'::text,
  "total_cents"       bigint,
  "processing_status" text                     NOT NULL DEFAULT 'draft'::text,
  "created_by"        uuid                     NOT NULL,
  "confirmed_by"      uuid,
  "confirmed_at"      timestamp with time zone,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at"        timestamp with time zone,
  CONSTRAINT "receipts_confirmation_pair" CHECK (((confirmed_by IS NULL) = (confirmed_at IS NULL))),
  CONSTRAINT "receipts_currency_check" CHECK ((currency = 'EUR'::text)),
  CONSTRAINT "receipts_id_household_key" UNIQUE (id, household_id),
  CONSTRAINT "receipts_pkey" PRIMARY KEY (id),
  CONSTRAINT "receipts_processing_status_check"
    CHECK ((processing_status = ANY (ARRAY['draft'::text, 'processing'::text, 'needs_review'::text, 'confirmed'::text, 'failed'::text]))),
  CONSTRAINT "receipts_total_cents_check" CHECK ((total_cents >= 0))
);

ALTER TABLE "public"."receipts"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.guard_receipt_confirmation_actor()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    return new;
  end if;

  if tg_op = 'INSERT'
     and new.confirmed_by is not null
     and new.confirmed_by is distinct from uid then
    raise exception using
      errcode = '42501',
      message = 'confirmed_by muss beim Setzen auth.uid() entsprechen';
  end if;

  if tg_op = 'UPDATE'
     and new.confirmed_by is distinct from old.confirmed_by
     and new.confirmed_by is not null
     and new.confirmed_by is distinct from uid then
    raise exception using
      errcode = '42501',
      message = 'confirmed_by muss beim Setzen auth.uid() entsprechen';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.guard_receipt_created_by()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  uid uuid := (select auth.uid());
begin
  -- Trusted server writes have no auth.uid() and are not durch Client-RLS
  -- erreichbar. Authenticated clients must use their own actor id.
  if uid is null then
    return new;
  end if;

  if tg_op = 'INSERT' and new.created_by is distinct from uid then
    raise exception using
      errcode = '42501',
      message = 'created_by muss auth.uid() entsprechen';
  end if;

  if tg_op = 'UPDATE' and new.created_by is distinct from old.created_by then
    raise exception using
      errcode = '42501',
      message = 'created_by darf nicht geaendert werden';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_receipt_store()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if new.store_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.stores
    where id = new.store_id
      and household_id = new.household_id
      and deleted_at is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'store_id muss auf einen aktiven Markt desselben Haushalts zeigen';
  end if;

  return new;
end;
$function$;

ALTER TABLE "public"."receipt_assets"
  ADD CONSTRAINT "receipt_assets_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE "public"."receipt_assets"
  ADD CONSTRAINT "receipt_assets_household_id_fkey" FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE "public"."receipt_items"
  ADD CONSTRAINT "receipt_items_household_id_fkey" FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE "public"."receipt_items"
  ADD CONSTRAINT "receipt_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE "public"."receipts"
  ADD CONSTRAINT "receipts_confirmed_by_fkey" FOREIGN KEY (confirmed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."receipts"
  ADD CONSTRAINT "receipts_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE "public"."receipts"
  ADD CONSTRAINT "receipts_household_id_fkey" FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE "public"."receipt_assets"
  ADD CONSTRAINT "receipt_assets_receipt_household_fkey" FOREIGN KEY (receipt_id, household_id) REFERENCES public.receipts(id, household_id) ON DELETE CASCADE;

ALTER TABLE "public"."receipt_items"
  ADD CONSTRAINT "receipt_items_receipt_household_fkey" FOREIGN KEY (receipt_id, household_id) REFERENCES public.receipts(id, household_id) ON DELETE CASCADE;

ALTER TABLE "public"."receipts"
  ADD CONSTRAINT "receipts_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX receipt_assets_active_sort_order_key ON public.receipt_assets USING btree (receipt_id, sort_order)
  WHERE (deleted_at IS NULL);

CREATE INDEX receipt_assets_household_updated_idx ON public.receipt_assets USING btree (household_id, created_at);

CREATE INDEX receipt_assets_receipt_id_idx ON public.receipt_assets USING btree (receipt_id);

CREATE UNIQUE INDEX receipt_items_active_position_key ON public.receipt_items USING btree (receipt_id, "position")
  WHERE (deleted_at IS NULL);

CREATE INDEX receipt_items_household_updated_idx ON public.receipt_items USING btree (household_id, updated_at);

CREATE INDEX receipt_items_product_id_idx ON public.receipt_items USING btree (product_id);

CREATE INDEX receipt_items_receipt_id_idx ON public.receipt_items USING btree (receipt_id);

CREATE INDEX receipts_household_id_idx ON public.receipts USING btree (household_id);

CREATE INDEX receipts_household_updated_idx ON public.receipts USING btree (household_id, updated_at);

CREATE INDEX receipts_store_id_idx ON public.receipts USING btree (store_id);

CREATE TRIGGER receipt_assets_guard_created_by
  BEFORE INSERT OR UPDATE ON public.receipt_assets
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_receipt_created_by();

CREATE TRIGGER receipt_items_set_updated_at
  BEFORE UPDATE ON public.receipt_items
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER receipts_guard_confirmation_actor
  BEFORE INSERT OR UPDATE ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_receipt_confirmation_actor();

CREATE TRIGGER receipts_guard_created_by
  BEFORE INSERT OR UPDATE ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_receipt_created_by();

CREATE TRIGGER receipts_set_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER receipts_validate_store
  BEFORE INSERT OR UPDATE ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_receipt_store();

CREATE POLICY "receipt_assets_delete_member" ON "public"."receipt_assets"
  FOR DELETE
  TO "authenticated"
  USING (( SELECT private.is_household_member(receipt_assets.household_id) AS is_household_member));

CREATE POLICY "receipt_assets_insert_member" ON "public"."receipt_assets"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT private.is_household_member(receipt_assets.household_id) AS is_household_member) AND (( SELECT auth.uid() AS uid) = created_by)));

CREATE POLICY "receipt_assets_select_member" ON "public"."receipt_assets"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT private.is_household_member(receipt_assets.household_id) AS is_household_member));

CREATE POLICY "receipt_assets_update_member" ON "public"."receipt_assets"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT private.is_household_member(receipt_assets.household_id) AS is_household_member))
  WITH CHECK (( SELECT private.is_household_member(receipt_assets.household_id) AS is_household_member));

CREATE POLICY "receipt_items_insert_member" ON "public"."receipt_items"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (( SELECT private.is_household_member(receipt_items.household_id) AS is_household_member));

CREATE POLICY "receipt_items_select_member" ON "public"."receipt_items"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT private.is_household_member(receipt_items.household_id) AS is_household_member));

CREATE POLICY "receipt_items_update_member" ON "public"."receipt_items"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT private.is_household_member(receipt_items.household_id) AS is_household_member))
  WITH CHECK (( SELECT private.is_household_member(receipt_items.household_id) AS is_household_member));

CREATE POLICY "receipts_insert_member" ON "public"."receipts"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT private.is_household_member(receipts.household_id) AS is_household_member) AND (( SELECT auth.uid() AS uid) = created_by)));

CREATE POLICY "receipts_select_member" ON "public"."receipts"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT private.is_household_member(receipts.household_id) AS is_household_member));

CREATE POLICY "receipts_update_member" ON "public"."receipts"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT private.is_household_member(receipts.household_id) AS is_household_member))
  WITH CHECK (( SELECT private.is_household_member(receipts.household_id) AS is_household_member));

COMMENT ON TABLE "public"."receipt_assets" IS 'Serverseitiger Index fuer private Receipt-Bilder. Keine SQLite-/Realtime-Entity und keine oeffentliche URL.';

COMMENT ON TABLE "public"."receipt_items" IS 'Normalisierte Produktposition eines Receipts. Rabatte, Coupons, Pfand und Treuekarten sind keine Items.';

COMMENT ON TABLE "public"."receipts" IS 'Geteilter Kassenbon eines Haushalts. EUR-Cents, Review-Status und Tombstone bleiben autoritativ auf dem Server.';

GRANT EXECUTE ON FUNCTION "private"."guard_receipt_confirmation_actor"() TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."guard_receipt_created_by"() TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."validate_receipt_store"() TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."receipt_assets" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."receipt_assets" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."receipt_assets" TO "service_role";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."receipt_items" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."receipt_items" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."receipt_items" TO "service_role";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."receipts" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."receipts" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."receipts" TO "service_role";
