CREATE TABLE "public"."allergen_taxonomy" (
  "id"         text                     NOT NULL,
  "sort_order" smallint                 NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "allergen_taxonomy_id_check"
    CHECK
    ((id = ANY (ARRAY['EU_01_GLUTEN_CEREALS'::text, 'EU_02_CRUSTACEANS'::text, 'EU_03_EGGS'::text, 'EU_04_FISH'::text, 'EU_05_PEANUTS'::text, 'EU_06_SOYBEANS'::text,
    'EU_07_MILK'::text,
    'EU_08_NUTS'::text, 'EU_09_CELERY'::text, 'EU_10_MUSTARD'::text, 'EU_11_SESAME'::text, 'EU_12_SULPHITES'::text, 'EU_13_LUPIN'::text, 'EU_14_MOLLUSCS'::text]))),
  CONSTRAINT "allergen_taxonomy_pkey" PRIMARY KEY (id),
  CONSTRAINT "allergen_taxonomy_sort_order_check" CHECK (((sort_order >= 1) AND (sort_order <= 14))),
  CONSTRAINT "allergen_taxonomy_sort_order_key" UNIQUE (sort_order)
);

ALTER TABLE "public"."allergen_taxonomy"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."allergen_taxonomy" FROM "anon";

CREATE TABLE "public"."catalog_recipe_item_ingredient_links" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "catalog_item_id" uuid                     NOT NULL,
  "ingredient_id"   uuid                     NOT NULL,
  "source"          text                     NOT NULL,
  "source_id"       text                     NOT NULL,
  "source_url"      text                     NOT NULL,
  "source_version"  text                     NOT NULL,
  "license"         text                     NOT NULL,
  "confidence"      text                     NOT NULL,
  "reviewed_at"     timestamp with time zone,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "catalog_recipe_item_ingredien_catalog_item_id_ingredient_id_key" UNIQUE (catalog_item_id, ingredient_id, source, source_id),
  CONSTRAINT "catalog_recipe_item_ingredient_link_verified_review_required" CHECK (((confidence <> 'verified'::text) OR (reviewed_at IS NOT NULL))),
  CONSTRAINT "catalog_recipe_item_ingredient_links_confidence_check" CHECK ((confidence = ANY (ARRAY['verified'::text, 'external'::text, 'inferred'::text]))),
  CONSTRAINT "catalog_recipe_item_ingredient_links_license_check" CHECK (((length(TRIM(BOTH FROM license)) >= 1) AND (length(TRIM(BOTH FROM license)) <= 160))),
  CONSTRAINT "catalog_recipe_item_ingredient_links_pkey" PRIMARY KEY (id),
  CONSTRAINT "catalog_recipe_item_ingredient_links_source_check" CHECK ((source = ANY (ARRAY['curated'::text, 'open_food_facts'::text, 'foodon'::text]))),
  CONSTRAINT "catalog_recipe_item_ingredient_links_source_id_check" CHECK (((length(TRIM(BOTH FROM source_id)) >= 1) AND (length(TRIM(BOTH FROM source_id)) <= 240))),
  CONSTRAINT "catalog_recipe_item_ingredient_links_source_url_check" CHECK (((length(TRIM(BOTH FROM source_url)) >= 1) AND (length(TRIM(BOTH FROM source_url)) <= 500))),
  CONSTRAINT "catalog_recipe_item_ingredient_links_source_version_check" CHECK (((length(TRIM(BOTH FROM source_version)) >= 1) AND (length(TRIM(BOTH FROM source_version)) <= 120)))
);

ALTER TABLE "public"."catalog_recipe_item_ingredient_links"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."catalog_recipe_item_ingredient_links" FROM "anon";

CREATE TABLE "public"."food_ingredients" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "canonical_name"       text                     NOT NULL,
  "allergen_reviewed_at" timestamp with time zone,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "food_ingredients_canonical_name_check" CHECK (((length(TRIM(BOTH FROM canonical_name)) >= 1) AND (length(TRIM(BOTH FROM canonical_name)) <= 200))),
  CONSTRAINT "food_ingredients_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."food_ingredients"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."food_ingredients" FROM "anon";

CREATE TABLE "public"."ingredient_allergen_mappings" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "ingredient_id"  uuid                     NOT NULL,
  "allergen_id"    text                     NOT NULL,
  "relation"       text                     NOT NULL,
  "source"         text                     NOT NULL,
  "source_id"      text                     NOT NULL,
  "source_url"     text                     NOT NULL,
  "source_version" text                     NOT NULL,
  "license"        text                     NOT NULL,
  "confidence"     text                     NOT NULL,
  "reviewed_at"    timestamp with time zone,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "ingredient_allergen_mappings_confidence_check" CHECK ((confidence = ANY (ARRAY['verified'::text, 'external'::text, 'inferred'::text]))),
  CONSTRAINT "ingredient_allergen_mappings_ingredient_id_allergen_id_rela_key" UNIQUE (ingredient_id, allergen_id, relation, source, source_id),
  CONSTRAINT "ingredient_allergen_mappings_license_check" CHECK (((length(TRIM(BOTH FROM license)) >= 1) AND (length(TRIM(BOTH FROM license)) <= 160))),
  CONSTRAINT "ingredient_allergen_mappings_pkey" PRIMARY KEY (id),
  CONSTRAINT "ingredient_allergen_mappings_relation_check" CHECK ((relation = ANY (ARRAY['contains'::text, 'derived_from'::text, 'may_contain'::text]))),
  CONSTRAINT "ingredient_allergen_mappings_source_check" CHECK ((source = ANY (ARRAY['curated'::text, 'eu_lmiv'::text, 'open_food_facts'::text, 'foodon'::text]))),
  CONSTRAINT "ingredient_allergen_mappings_source_id_check" CHECK (((length(TRIM(BOTH FROM source_id)) >= 1) AND (length(TRIM(BOTH FROM source_id)) <= 240))),
  CONSTRAINT "ingredient_allergen_mappings_source_url_check" CHECK (((length(TRIM(BOTH FROM source_url)) >= 1) AND (length(TRIM(BOTH FROM source_url)) <= 500))),
  CONSTRAINT "ingredient_allergen_mappings_source_version_check" CHECK (((length(TRIM(BOTH FROM source_version)) >= 1) AND (length(TRIM(BOTH FROM source_version)) <= 120))),
  CONSTRAINT "ingredient_allergen_verified_review_required" CHECK (((confidence <> 'verified'::text) OR (reviewed_at IS NOT NULL)))
);

ALTER TABLE "public"."ingredient_allergen_mappings"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."ingredient_allergen_mappings" FROM "anon";

CREATE TABLE "public"."product_ingredient_links" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "product_id"     uuid                     NOT NULL,
  "ingredient_id"  uuid                     NOT NULL,
  "source"         text                     NOT NULL,
  "source_id"      text                     NOT NULL,
  "source_url"     text                     NOT NULL,
  "source_version" text                     NOT NULL,
  "license"        text                     NOT NULL,
  "confidence"     text                     NOT NULL,
  "reviewed_at"    timestamp with time zone,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "product_ingredient_link_verified_review_required" CHECK (((confidence <> 'verified'::text) OR (reviewed_at IS NOT NULL))),
  CONSTRAINT "product_ingredient_links_confidence_check" CHECK ((confidence = ANY (ARRAY['verified'::text, 'external'::text, 'inferred'::text]))),
  CONSTRAINT "product_ingredient_links_license_check" CHECK (((length(TRIM(BOTH FROM license)) >= 1) AND (length(TRIM(BOTH FROM license)) <= 160))),
  CONSTRAINT "product_ingredient_links_pkey" PRIMARY KEY (id),
  CONSTRAINT "product_ingredient_links_product_id_ingredient_id_source_so_key" UNIQUE (product_id, ingredient_id, source, source_id),
  CONSTRAINT "product_ingredient_links_source_check" CHECK ((source = ANY (ARRAY['curated'::text, 'open_food_facts'::text, 'foodon'::text]))),
  CONSTRAINT "product_ingredient_links_source_id_check" CHECK (((length(TRIM(BOTH FROM source_id)) >= 1) AND (length(TRIM(BOTH FROM source_id)) <= 240))),
  CONSTRAINT "product_ingredient_links_source_url_check" CHECK (((length(TRIM(BOTH FROM source_url)) >= 1) AND (length(TRIM(BOTH FROM source_url)) <= 500))),
  CONSTRAINT "product_ingredient_links_source_version_check" CHECK (((length(TRIM(BOTH FROM source_version)) >= 1) AND (length(TRIM(BOTH FROM source_version)) <= 120)))
);

ALTER TABLE "public"."product_ingredient_links"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."product_ingredient_links" FROM "anon";

ALTER TABLE "public"."catalog_recipe_item_ingredient_links"
  ADD CONSTRAINT "catalog_recipe_item_ingredient_links_catalog_item_id_fkey" FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_recipe_component_items(id) ON DELETE CASCADE;

ALTER TABLE "public"."catalog_recipe_item_ingredient_links"
  ADD CONSTRAINT "catalog_recipe_item_ingredient_links_ingredient_id_fkey" FOREIGN KEY (ingredient_id) REFERENCES public.food_ingredients(id) ON DELETE CASCADE;

ALTER TABLE "public"."ingredient_allergen_mappings"
  ADD CONSTRAINT "ingredient_allergen_mappings_allergen_id_fkey" FOREIGN KEY (allergen_id) REFERENCES public.allergen_taxonomy(id);

ALTER TABLE "public"."ingredient_allergen_mappings"
  ADD CONSTRAINT "ingredient_allergen_mappings_ingredient_id_fkey" FOREIGN KEY (ingredient_id) REFERENCES public.food_ingredients(id) ON DELETE CASCADE;

ALTER TABLE "public"."product_ingredient_links"
  ADD CONSTRAINT "product_ingredient_links_ingredient_id_fkey" FOREIGN KEY (ingredient_id) REFERENCES public.food_ingredients(id) ON DELETE CASCADE;

ALTER TABLE "public"."product_ingredient_links"
  ADD CONSTRAINT "product_ingredient_links_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

CREATE INDEX catalog_recipe_item_ingredient_links_ingredient_idx ON public.catalog_recipe_item_ingredient_links USING btree (ingredient_id, catalog_item_id);

CREATE UNIQUE INDEX food_ingredients_canonical_name_idx ON public.food_ingredients USING btree (lower(TRIM(BOTH FROM canonical_name)));

CREATE INDEX ingredient_allergen_mappings_allergen_idx ON public.ingredient_allergen_mappings USING btree (allergen_id, ingredient_id);

CREATE INDEX product_ingredient_links_ingredient_idx ON public.product_ingredient_links USING btree (ingredient_id, product_id);

CREATE TRIGGER allergen_taxonomy_set_updated_at
  BEFORE UPDATE ON public.allergen_taxonomy
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER catalog_recipe_item_ingredient_links_set_updated_at
  BEFORE UPDATE ON public.catalog_recipe_item_ingredient_links
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER food_ingredients_set_updated_at
  BEFORE UPDATE ON public.food_ingredients
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER ingredient_allergen_mappings_set_updated_at
  BEFORE UPDATE ON public.ingredient_allergen_mappings
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER product_ingredient_links_set_updated_at
  BEFORE UPDATE ON public.product_ingredient_links
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY "allergen_taxonomy_select_authenticated" ON "public"."allergen_taxonomy"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "catalog_recipe_item_ingredient_links_select_published" ON "public"."catalog_recipe_item_ingredient_links"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (public.catalog_recipe_component_items item
     JOIN public.catalog_recipes recipe ON ((recipe.id = item.recipe_id)))
  WHERE ((item.id = catalog_recipe_item_ingredient_links.catalog_item_id) AND (recipe.status = 'published'::text)))));

CREATE POLICY "food_ingredients_select_authenticated" ON "public"."food_ingredients"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "ingredient_allergen_mappings_select_authenticated" ON "public"."ingredient_allergen_mappings"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "product_ingredient_links_select_authenticated" ON "public"."product_ingredient_links"
  FOR SELECT
  TO "authenticated"
  USING (true);

COMMENT ON COLUMN "public"."food_ingredients"."allergen_reviewed_at" IS 'Null means allergen knowledge is incomplete; a timestamp marks a complete review, including a reviewed clear result.';

COMMENT ON TABLE "public"."allergen_taxonomy" IS 'Referenzcodes fuer die vierzehn Allergengruppen aus EU 1169/2011 Annex II.';

REVOKE ALL ON TABLE "public"."allergen_taxonomy" FROM "authenticated";

GRANT SELECT ON TABLE "public"."allergen_taxonomy" TO "authenticated";

REVOKE ALL ON TABLE "public"."allergen_taxonomy" FROM "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."allergen_taxonomy" TO "service_role";

REVOKE ALL ON TABLE "public"."catalog_recipe_item_ingredient_links" FROM "authenticated";

GRANT SELECT ON TABLE "public"."catalog_recipe_item_ingredient_links" TO "authenticated";

REVOKE ALL ON TABLE "public"."catalog_recipe_item_ingredient_links" FROM "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."catalog_recipe_item_ingredient_links" TO "service_role";

REVOKE ALL ON TABLE "public"."food_ingredients" FROM "authenticated";

GRANT SELECT ON TABLE "public"."food_ingredients" TO "authenticated";

REVOKE ALL ON TABLE "public"."food_ingredients" FROM "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."food_ingredients" TO "service_role";

REVOKE ALL ON TABLE "public"."ingredient_allergen_mappings" FROM "authenticated";

GRANT SELECT ON TABLE "public"."ingredient_allergen_mappings" TO "authenticated";

REVOKE ALL ON TABLE "public"."ingredient_allergen_mappings" FROM "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."ingredient_allergen_mappings" TO "service_role";

REVOKE ALL ON TABLE "public"."product_ingredient_links" FROM "authenticated";

GRANT SELECT ON TABLE "public"."product_ingredient_links" TO "authenticated";

REVOKE ALL ON TABLE "public"."product_ingredient_links" FROM "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."product_ingredient_links" TO "service_role";
