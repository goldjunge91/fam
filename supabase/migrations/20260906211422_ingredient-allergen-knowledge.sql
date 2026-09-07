CREATE TABLE "public"."allergen_taxonomy" (
  "id"             text                     NOT NULL,
  "canonical_name" text                     NOT NULL,
  "legal_code"     text                     NOT NULL,
  "source"         text                     NOT NULL DEFAULT 'eu_lmiv'::text,
  "source_id"      text                     NOT NULL,
  "source_url"     text                     NOT NULL,
  "source_version" text                     NOT NULL,
  "license"        text                     NOT NULL,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "allergen_taxonomy_canonical_name_check" CHECK (((length(TRIM(BOTH FROM canonical_name)) >= 1) AND (length(TRIM(BOTH FROM canonical_name)) <= 160))),
  CONSTRAINT "allergen_taxonomy_id_check"
    CHECK
    ((id = ANY (ARRAY['EU_01_GLUTEN_CEREALS'::text, 'EU_02_CRUSTACEANS'::text, 'EU_03_EGGS'::text, 'EU_04_FISH'::text, 'EU_05_PEANUTS'::text, 'EU_06_SOYBEANS'::text,
    'EU_07_MILK'::text,
    'EU_08_NUTS'::text, 'EU_09_CELERY'::text, 'EU_10_MUSTARD'::text, 'EU_11_SESAME'::text, 'EU_12_SULPHITES'::text, 'EU_13_LUPIN'::text, 'EU_14_MOLLUSCS'::text]))),
  CONSTRAINT "allergen_taxonomy_legal_code_check"
    CHECK
    ((legal_code = ANY (ARRAY['annex-ii-01'::text, 'annex-ii-02'::text, 'annex-ii-03'::text, 'annex-ii-04'::text, 'annex-ii-05'::text, 'annex-ii-06'::text, 'annex-ii-07'::text,
    'annex-ii-08'::text, 'annex-ii-09'::text, 'annex-ii-10'::text, 'annex-ii-11'::text, 'annex-ii-12'::text, 'annex-ii-13'::text, 'annex-ii-14'::text]))),
  CONSTRAINT "allergen_taxonomy_legal_code_key" UNIQUE (legal_code),
  CONSTRAINT "allergen_taxonomy_license_check" CHECK (((length(TRIM(BOTH FROM license)) >= 1) AND (length(TRIM(BOTH FROM license)) <= 160))),
  CONSTRAINT "allergen_taxonomy_pkey" PRIMARY KEY (id),
  CONSTRAINT "allergen_taxonomy_source_check" CHECK ((source = 'eu_lmiv'::text)),
  CONSTRAINT "allergen_taxonomy_source_id_check" CHECK (((length(TRIM(BOTH FROM source_id)) >= 1) AND (length(TRIM(BOTH FROM source_id)) <= 200))),
  CONSTRAINT "allergen_taxonomy_source_url_check" CHECK (((length(TRIM(BOTH FROM source_url)) >= 1) AND (length(TRIM(BOTH FROM source_url)) <= 500))),
  CONSTRAINT "allergen_taxonomy_source_version_check" CHECK (((length(TRIM(BOTH FROM source_version)) >= 1) AND (length(TRIM(BOTH FROM source_version)) <= 120)))
);

ALTER TABLE "public"."allergen_taxonomy"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."catalog_recipe_item_ingredient_links" (
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
  CONSTRAINT "catalog_recipe_item_ingredient_link_review_required" CHECK (((confidence <> 'verified'::text) OR (reviewed_at IS NOT NULL))),
  CONSTRAINT "catalog_recipe_item_ingredient_links_confidence_check" CHECK ((confidence = ANY (ARRAY['verified'::text, 'external'::text, 'inferred'::text]))),
  CONSTRAINT "catalog_recipe_item_ingredient_links_license_check" CHECK (((length(TRIM(BOTH FROM license)) >= 1) AND (length(TRIM(BOTH FROM license)) <= 160))),
  CONSTRAINT "catalog_recipe_item_ingredient_links_pkey" PRIMARY KEY (catalog_item_id, ingredient_id, source),
  CONSTRAINT "catalog_recipe_item_ingredient_links_source_check" CHECK ((source = ANY (ARRAY['open_food_facts'::text, 'foodon'::text, 'curated'::text]))),
  CONSTRAINT "catalog_recipe_item_ingredient_links_source_id_check" CHECK (((length(TRIM(BOTH FROM source_id)) >= 1) AND (length(TRIM(BOTH FROM source_id)) <= 240))),
  CONSTRAINT "catalog_recipe_item_ingredient_links_source_url_check" CHECK (((length(TRIM(BOTH FROM source_url)) >= 1) AND (length(TRIM(BOTH FROM source_url)) <= 500))),
  CONSTRAINT "catalog_recipe_item_ingredient_links_source_version_check" CHECK (((length(TRIM(BOTH FROM source_version)) >= 1) AND (length(TRIM(BOTH FROM source_version)) <= 120)))
);

ALTER TABLE "public"."catalog_recipe_item_ingredient_links"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."external_food_aliases" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "ingredient_id"  uuid                     NOT NULL,
  "alias"          text                     NOT NULL,
  "locale"         text                     NOT NULL DEFAULT 'de'::text,
  "source"         text                     NOT NULL,
  "source_id"      text                     NOT NULL,
  "source_url"     text                     NOT NULL,
  "source_version" text                     NOT NULL,
  "license"        text                     NOT NULL,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "external_food_aliases_alias_check" CHECK (((length(TRIM(BOTH FROM alias)) >= 1) AND (length(TRIM(BOTH FROM alias)) <= 200))),
  CONSTRAINT "external_food_aliases_ingredient_id_alias_locale_source_key" UNIQUE (ingredient_id, alias, LOCALE, source),
  CONSTRAINT "external_food_aliases_license_check" CHECK (((length(TRIM(BOTH FROM license)) >= 1) AND (length(TRIM(BOTH FROM license)) <= 160))),
  CONSTRAINT "external_food_aliases_locale_check" CHECK (((length(TRIM(BOTH FROM locale)) >= 2) AND (length(TRIM(BOTH FROM locale)) <= 16))),
  CONSTRAINT "external_food_aliases_pkey" PRIMARY KEY (id),
  CONSTRAINT "external_food_aliases_source_check" CHECK ((source = ANY (ARRAY['eu_lmiv'::text, 'open_food_facts'::text, 'foodon'::text, 'curated'::text]))),
  CONSTRAINT "external_food_aliases_source_id_check" CHECK (((length(TRIM(BOTH FROM source_id)) >= 1) AND (length(TRIM(BOTH FROM source_id)) <= 240))),
  CONSTRAINT "external_food_aliases_source_url_check" CHECK (((length(TRIM(BOTH FROM source_url)) >= 1) AND (length(TRIM(BOTH FROM source_url)) <= 500))),
  CONSTRAINT "external_food_aliases_source_version_check" CHECK (((length(TRIM(BOTH FROM source_version)) >= 1) AND (length(TRIM(BOTH FROM source_version)) <= 120)))
);

ALTER TABLE "public"."external_food_aliases"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."external_food_ingredients" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "canonical_name"       text                     NOT NULL,
  "foodon_id"            text,
  "source"               text                     NOT NULL,
  "source_id"            text                     NOT NULL,
  "source_url"           text                     NOT NULL,
  "source_version"       text                     NOT NULL,
  "license"              text                     NOT NULL,
  "allergen_resolution"  text                     NOT NULL DEFAULT 'unknown'::text,
  "allergen_reviewed_at" timestamp with time zone,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "external_food_ingredient_clear_review_required" CHECK (((allergen_resolution <> 'clear'::text) OR (allergen_reviewed_at IS NOT NULL))),
  CONSTRAINT "external_food_ingredients_allergen_resolution_check" CHECK ((allergen_resolution = ANY (ARRAY['unknown'::text, 'clear'::text, 'mapped'::text]))),
  CONSTRAINT "external_food_ingredients_canonical_name_check" CHECK (((length(TRIM(BOTH FROM canonical_name)) >= 1) AND (length(TRIM(BOTH FROM canonical_name)) <= 200))),
  CONSTRAINT "external_food_ingredients_foodon_id_check" CHECK (((foodon_id IS NULL) OR ((length(TRIM(BOTH FROM foodon_id)) >= 1) AND (length(TRIM(BOTH FROM foodon_id)) <= 200)))),
  CONSTRAINT "external_food_ingredients_foodon_id_key" UNIQUE (foodon_id),
  CONSTRAINT "external_food_ingredients_license_check" CHECK (((length(TRIM(BOTH FROM license)) >= 1) AND (length(TRIM(BOTH FROM license)) <= 160))),
  CONSTRAINT "external_food_ingredients_pkey" PRIMARY KEY (id),
  CONSTRAINT "external_food_ingredients_source_check" CHECK ((source = ANY (ARRAY['eu_lmiv'::text, 'open_food_facts'::text, 'foodon'::text, 'curated'::text]))),
  CONSTRAINT "external_food_ingredients_source_id_check" CHECK (((length(TRIM(BOTH FROM source_id)) >= 1) AND (length(TRIM(BOTH FROM source_id)) <= 240))),
  CONSTRAINT "external_food_ingredients_source_source_id_key" UNIQUE (source, source_id),
  CONSTRAINT "external_food_ingredients_source_url_check" CHECK (((length(TRIM(BOTH FROM source_url)) >= 1) AND (length(TRIM(BOTH FROM source_url)) <= 500))),
  CONSTRAINT "external_food_ingredients_source_version_check" CHECK (((length(TRIM(BOTH FROM source_version)) >= 1) AND (length(TRIM(BOTH FROM source_version)) <= 120)))
);

ALTER TABLE "public"."external_food_ingredients"
  ENABLE ROW LEVEL SECURITY;

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
  CONSTRAINT "ingredient_allergen_mappings_confidence_check" CHECK ((confidence = ANY (ARRAY['regulatory'::text, 'verified'::text, 'external'::text, 'inferred'::text]))),
  CONSTRAINT "ingredient_allergen_mappings_ingredient_id_allergen_id_rela_key" UNIQUE (ingredient_id, allergen_id, relation, source, source_id),
  CONSTRAINT "ingredient_allergen_mappings_license_check" CHECK (((length(TRIM(BOTH FROM license)) >= 1) AND (length(TRIM(BOTH FROM license)) <= 160))),
  CONSTRAINT "ingredient_allergen_mappings_pkey" PRIMARY KEY (id),
  CONSTRAINT "ingredient_allergen_mappings_relation_check" CHECK ((relation = ANY (ARRAY['contains'::text, 'derived_from'::text, 'may_contain'::text, 'exempt'::text]))),
  CONSTRAINT "ingredient_allergen_mappings_source_check" CHECK ((source = ANY (ARRAY['eu_lmiv'::text, 'open_food_facts'::text, 'foodon'::text, 'curated'::text]))),
  CONSTRAINT "ingredient_allergen_mappings_source_id_check" CHECK (((length(TRIM(BOTH FROM source_id)) >= 1) AND (length(TRIM(BOTH FROM source_id)) <= 240))),
  CONSTRAINT "ingredient_allergen_mappings_source_url_check" CHECK (((length(TRIM(BOTH FROM source_url)) >= 1) AND (length(TRIM(BOTH FROM source_url)) <= 500))),
  CONSTRAINT "ingredient_allergen_mappings_source_version_check" CHECK (((length(TRIM(BOTH FROM source_version)) >= 1) AND (length(TRIM(BOTH FROM source_version)) <= 120))),
  CONSTRAINT "ingredient_allergen_review_required" CHECK (((confidence <> ALL (ARRAY['regulatory'::text, 'verified'::text])) OR (reviewed_at IS NOT NULL)))
);

ALTER TABLE "public"."ingredient_allergen_mappings"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."product_ingredient_links" (
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
  CONSTRAINT "product_ingredient_link_review_required" CHECK (((confidence <> 'verified'::text) OR (reviewed_at IS NOT NULL))),
  CONSTRAINT "product_ingredient_links_confidence_check" CHECK ((confidence = ANY (ARRAY['verified'::text, 'external'::text, 'inferred'::text]))),
  CONSTRAINT "product_ingredient_links_license_check" CHECK (((length(TRIM(BOTH FROM license)) >= 1) AND (length(TRIM(BOTH FROM license)) <= 160))),
  CONSTRAINT "product_ingredient_links_pkey" PRIMARY KEY (product_id, ingredient_id, source),
  CONSTRAINT "product_ingredient_links_source_check" CHECK ((source = ANY (ARRAY['open_food_facts'::text, 'foodon'::text, 'curated'::text]))),
  CONSTRAINT "product_ingredient_links_source_id_check" CHECK (((length(TRIM(BOTH FROM source_id)) >= 1) AND (length(TRIM(BOTH FROM source_id)) <= 240))),
  CONSTRAINT "product_ingredient_links_source_url_check" CHECK (((length(TRIM(BOTH FROM source_url)) >= 1) AND (length(TRIM(BOTH FROM source_url)) <= 500))),
  CONSTRAINT "product_ingredient_links_source_version_check" CHECK (((length(TRIM(BOTH FROM source_version)) >= 1) AND (length(TRIM(BOTH FROM source_version)) <= 120)))
);

ALTER TABLE "public"."product_ingredient_links"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."catalog_recipe_item_ingredient_links"
  ADD CONSTRAINT "catalog_recipe_item_ingredient_links_catalog_item_id_fkey" FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_recipe_component_items(id) ON DELETE CASCADE;

ALTER TABLE "public"."catalog_recipe_item_ingredient_links"
  ADD CONSTRAINT "catalog_recipe_item_ingredient_links_ingredient_id_fkey" FOREIGN KEY (ingredient_id) REFERENCES public.external_food_ingredients(id) ON DELETE CASCADE;

ALTER TABLE "public"."external_food_aliases"
  ADD CONSTRAINT "external_food_aliases_ingredient_id_fkey" FOREIGN KEY (ingredient_id) REFERENCES public.external_food_ingredients(id) ON DELETE CASCADE;

ALTER TABLE "public"."ingredient_allergen_mappings"
  ADD CONSTRAINT "ingredient_allergen_mappings_allergen_id_fkey" FOREIGN KEY (allergen_id) REFERENCES public.allergen_taxonomy(id);

ALTER TABLE "public"."ingredient_allergen_mappings"
  ADD CONSTRAINT "ingredient_allergen_mappings_ingredient_id_fkey" FOREIGN KEY (ingredient_id) REFERENCES public.external_food_ingredients(id) ON DELETE CASCADE;

ALTER TABLE "public"."product_ingredient_links"
  ADD CONSTRAINT "product_ingredient_links_ingredient_id_fkey" FOREIGN KEY (ingredient_id) REFERENCES public.external_food_ingredients(id) ON DELETE CASCADE;

ALTER TABLE "public"."product_ingredient_links"
  ADD CONSTRAINT "product_ingredient_links_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

CREATE INDEX catalog_recipe_item_ingredient_links_ingredient_idx ON public.catalog_recipe_item_ingredient_links USING btree (ingredient_id, catalog_item_id);

CREATE INDEX external_food_aliases_lookup_idx ON public.external_food_aliases USING btree (alias, LOCALE);

CREATE INDEX external_food_ingredients_name_idx ON public.external_food_ingredients USING btree (canonical_name);

CREATE INDEX ingredient_allergen_mappings_ingredient_idx ON public.ingredient_allergen_mappings USING btree (ingredient_id, allergen_id);

CREATE INDEX product_ingredient_links_ingredient_idx ON public.product_ingredient_links USING btree (ingredient_id, product_id);

CREATE TRIGGER allergen_taxonomy_set_updated_at
  BEFORE UPDATE ON public.allergen_taxonomy
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER catalog_recipe_item_ingredient_links_set_updated_at
  BEFORE UPDATE ON public.catalog_recipe_item_ingredient_links
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER external_food_aliases_set_updated_at
  BEFORE UPDATE ON public.external_food_aliases
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER external_food_ingredients_set_updated_at
  BEFORE UPDATE ON public.external_food_ingredients
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

CREATE POLICY "external_food_aliases_select_authenticated" ON "public"."external_food_aliases"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "external_food_ingredients_select_authenticated" ON "public"."external_food_ingredients"
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

COMMENT ON COLUMN "public"."external_food_ingredients"."allergen_resolution" IS 'unknown means no safety conclusion; clear is reviewed without a declared allergen; mapped has explicit mapping rows.';

COMMENT ON COLUMN "public"."external_food_ingredients"."allergen_reviewed_at" IS 'A clear resolution is usable only when a reviewer timestamp is present.';

COMMENT ON TABLE "public"."allergen_taxonomy" IS 'Normative EU-LMIV Annex-II taxonomy; ingredient mappings live separately.';

COMMENT ON TABLE "public"."catalog_recipe_item_ingredient_links" IS 'Provider-/Kurationslink eines publizierten Katalogitems auf eine lokale Ingredient-Identitaet.';

COMMENT ON TABLE "public"."ingredient_allergen_mappings" IS 'Provenance-bearing evidence; may_contain and inferred are never a safety clearance.';

COMMENT ON TABLE "public"."product_ingredient_links" IS 'Provider-/Kurationslink eines globalen Produkts auf eine lokale Ingredient-Identitaet.';

GRANT SELECT ON TABLE "public"."allergen_taxonomy" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."allergen_taxonomy" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."allergen_taxonomy" TO "service_role";

GRANT SELECT ON TABLE "public"."catalog_recipe_item_ingredient_links" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."catalog_recipe_item_ingredient_links" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."catalog_recipe_item_ingredient_links" TO "service_role";

GRANT SELECT ON TABLE "public"."external_food_aliases" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."external_food_aliases" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."external_food_aliases" TO "service_role";

GRANT SELECT ON TABLE "public"."external_food_ingredients" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."external_food_ingredients" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."external_food_ingredients" TO "service_role";

GRANT SELECT ON TABLE "public"."ingredient_allergen_mappings" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."ingredient_allergen_mappings" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."ingredient_allergen_mappings" TO "service_role";

GRANT SELECT ON TABLE "public"."product_ingredient_links" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."product_ingredient_links" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."product_ingredient_links" TO "service_role";
