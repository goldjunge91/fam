CREATE TABLE IF NOT EXISTS "public"."allergen_taxonomy" (
  "id"            text                     NOT NULL,
  "sort_order"    smallint                 NOT NULL,
  "legal_name_de" text                     NOT NULL,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "allergen_taxonomy_id_check"
    CHECK
    ((id = ANY (ARRAY['EU_01_GLUTEN_CEREALS'::text, 'EU_02_CRUSTACEANS'::text, 'EU_03_EGGS'::text, 'EU_04_FISH'::text, 'EU_05_PEANUTS'::text, 'EU_06_SOYBEANS'::text,
    'EU_07_MILK'::text,
    'EU_08_NUTS'::text, 'EU_09_CELERY'::text, 'EU_10_MUSTARD'::text, 'EU_11_SESAME'::text, 'EU_12_SULPHITES'::text, 'EU_13_LUPIN'::text, 'EU_14_MOLLUSCS'::text]))),
  CONSTRAINT "allergen_taxonomy_legal_name_de_check" CHECK (((length(TRIM(BOTH FROM legal_name_de)) >= 1) AND (length(TRIM(BOTH FROM legal_name_de)) <= 240))),
  CONSTRAINT "allergen_taxonomy_pkey" PRIMARY KEY (id),
  CONSTRAINT "allergen_taxonomy_sort_order_check" CHECK (((sort_order >= 1) AND (sort_order <= 14))),
  CONSTRAINT "allergen_taxonomy_sort_order_key" UNIQUE (sort_order)
);

ALTER TABLE "public"."allergen_taxonomy"
  ADD COLUMN IF NOT EXISTS "legal_name_de" text;

UPDATE "public"."allergen_taxonomy"
SET "legal_name_de" = CASE "id"
  WHEN 'EU_01_GLUTEN_CEREALS' THEN 'Glutenhaltiges Getreide'
  WHEN 'EU_02_CRUSTACEANS' THEN 'Krebstiere'
  WHEN 'EU_03_EGGS' THEN 'Eier'
  WHEN 'EU_04_FISH' THEN 'Fische'
  WHEN 'EU_05_PEANUTS' THEN 'Erdnüsse'
  WHEN 'EU_06_SOYBEANS' THEN 'Sojabohnen'
  WHEN 'EU_07_MILK' THEN 'Milch und daraus gewonnene Erzeugnisse (einschließlich Laktose)'
  WHEN 'EU_08_NUTS' THEN 'Schalenfrüchte'
  WHEN 'EU_09_CELERY' THEN 'Sellerie'
  WHEN 'EU_10_MUSTARD' THEN 'Senf'
  WHEN 'EU_11_SESAME' THEN 'Sesamsamen'
  WHEN 'EU_12_SULPHITES' THEN 'Schwefeldioxid und Sulphite'
  WHEN 'EU_13_LUPIN' THEN 'Lupinen'
  WHEN 'EU_14_MOLLUSCS' THEN 'Weichtiere'
  ELSE "legal_name_de"
END
;

ALTER TABLE "public"."allergen_taxonomy"
  ALTER COLUMN "legal_name_de" SET NOT NULL;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.allergen_taxonomy'::regclass
      AND conname = 'allergen_taxonomy_legal_name_de_check'
  ) THEN
    ALTER TABLE "public"."allergen_taxonomy"
      ADD CONSTRAINT "allergen_taxonomy_legal_name_de_check"
      CHECK (length(trim("legal_name_de")) BETWEEN 1 AND 240);
  END IF;
END;
$migration$;

ALTER TABLE "public"."allergen_taxonomy"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."allergen_taxonomy" FROM "anon";

CREATE TABLE IF NOT EXISTS "public"."food_ingredient_aliases" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "ingredient_id"  uuid                     NOT NULL,
  "alias"          text                     NOT NULL,
  "locale"         text                     NOT NULL DEFAULT 'de'::text,
  "source"         text                     NOT NULL,
  "source_id"      text                     NOT NULL,
  "source_url"     text                     NOT NULL,
  "source_version" text                     NOT NULL,
  "license"        text                     NOT NULL,
  "confidence"     text                     NOT NULL,
  "reviewed_at"    timestamp with time zone,
  "reviewed_by"    text,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "food_ingredient_alias_verified_review_required" CHECK (((confidence <> 'verified'::text) OR ((reviewed_at IS
    NOT NULL) AND (length(TRIM(BOTH FROM COALESCE(reviewed_by, ''::text))) > 0)))),
  CONSTRAINT "food_ingredient_aliases_alias_check" CHECK (((length(TRIM(BOTH FROM alias)) >= 1) AND (length(TRIM(BOTH FROM alias)) <= 200))),
  CONSTRAINT "food_ingredient_aliases_confidence_check" CHECK ((confidence = ANY (ARRAY['verified'::text, 'external'::text, 'inferred'::text, 'pending'::text]))),
  CONSTRAINT "food_ingredient_aliases_license_check" CHECK (((length(TRIM(BOTH FROM license)) >= 1) AND (length(TRIM(BOTH FROM license)) <= 160))),
  CONSTRAINT "food_ingredient_aliases_pkey" PRIMARY KEY (id),
  CONSTRAINT "food_ingredient_aliases_source_check" CHECK ((source = ANY (ARRAY['curated'::text, 'eu_lmiv'::text, 'open_food_facts'::text, 'foodon'::text]))),
  CONSTRAINT "food_ingredient_aliases_source_id_check" CHECK (((length(TRIM(BOTH FROM source_id)) >= 1) AND (length(TRIM(BOTH FROM source_id)) <= 240))),
  CONSTRAINT "food_ingredient_aliases_source_url_check" CHECK (((length(TRIM(BOTH FROM source_url)) >= 1) AND (length(TRIM(BOTH FROM source_url)) <= 500))),
  CONSTRAINT "food_ingredient_aliases_source_version_check" CHECK (((length(TRIM(BOTH FROM source_version)) >= 1) AND (length(TRIM(BOTH FROM source_version)) <= 120)))
);

ALTER TABLE "public"."food_ingredient_aliases"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."food_ingredient_aliases" FROM "anon";

CREATE TABLE IF NOT EXISTS "public"."food_ingredients" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "canonical_name" text                     NOT NULL,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "food_ingredients_canonical_name_check" CHECK (((length(TRIM(BOTH FROM canonical_name)) >= 1) AND (length(TRIM(BOTH FROM canonical_name)) <= 200))),
  CONSTRAINT "food_ingredients_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."food_ingredients"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."food_ingredients" FROM "anon";

CREATE TABLE IF NOT EXISTS "public"."ingredient_allergen_assessments" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "ingredient_id"     uuid                     NOT NULL,
  "allergen_id"       text                     NOT NULL,
  "assessment"        text                     NOT NULL,
  "source"            text                     NOT NULL,
  "source_id"         text                     NOT NULL,
  "source_url"        text                     NOT NULL,
  "source_version"    text                     NOT NULL,
  "license"           text                     NOT NULL,
  "review_scope"      text                     NOT NULL,
  "evidence_snapshot" text                     NOT NULL,
  "evidence_sha256"   text,
  "confidence"        text                     NOT NULL,
  "reviewed_at"       timestamp with time zone,
  "reviewed_by"       text,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "ingredient_allergen_assessmen_ingredient_id_allergen_id_sou_key" UNIQUE (ingredient_id, allergen_id, source, source_id, source_version),
  CONSTRAINT "ingredient_allergen_assessments_assessment_check"
    CHECK ((assessment = ANY (ARRAY['contains'::text, 'derived_from'::text, 'may_contain'::text, 'not_detected'::text]))),
  CONSTRAINT "ingredient_allergen_assessments_confidence_check" CHECK ((confidence = ANY (ARRAY['verified'::text, 'external'::text, 'inferred'::text, 'pending'::text]))),
  CONSTRAINT "ingredient_allergen_assessments_evidence_sha256_check" CHECK (((evidence_sha256 IS NULL) OR (evidence_sha256 ~ '^[0-9a-f]{64}$'::text))),
  CONSTRAINT "ingredient_allergen_assessments_evidence_snapshot_check"
    CHECK (((length(TRIM(BOTH FROM evidence_snapshot)) >= 1) AND (length(TRIM(BOTH FROM evidence_snapshot)) <= 12000))),
  CONSTRAINT "ingredient_allergen_assessments_license_check" CHECK (((length(TRIM(BOTH FROM license)) >= 1) AND (length(TRIM(BOTH FROM license)) <= 160))),
  CONSTRAINT "ingredient_allergen_assessments_pkey" PRIMARY KEY (id),
  CONSTRAINT "ingredient_allergen_assessments_review_scope_check" CHECK (((length(TRIM(BOTH FROM review_scope)) >= 1) AND (length(TRIM(BOTH FROM review_scope)) <= 1000))),
  CONSTRAINT "ingredient_allergen_assessments_source_check" CHECK ((source = ANY (ARRAY['curated'::text, 'eu_lmiv'::text, 'open_food_facts'::text, 'foodon'::text]))),
  CONSTRAINT "ingredient_allergen_assessments_source_id_check" CHECK (((length(TRIM(BOTH FROM source_id)) >= 1) AND (length(TRIM(BOTH FROM source_id)) <= 240))),
  CONSTRAINT "ingredient_allergen_assessments_source_url_check" CHECK (((length(TRIM(BOTH FROM source_url)) >= 1) AND (length(TRIM(BOTH FROM source_url)) <= 500))),
  CONSTRAINT "ingredient_allergen_assessments_source_version_check" CHECK (((length(TRIM(BOTH FROM source_version)) >= 1) AND (length(TRIM(BOTH FROM source_version)) <= 120))),
  CONSTRAINT "ingredient_allergen_not_detected_must_be_verified" CHECK (((assessment <> 'not_detected'::text) OR (confidence = 'verified'::text))),
  CONSTRAINT "ingredient_allergen_verified_review_required" CHECK (((confidence <> 'verified'::text) OR ((reviewed_at IS
    NOT NULL) AND (length(TRIM(BOTH FROM COALESCE(reviewed_by, ''::text))) > 0))))
);

ALTER TABLE "public"."ingredient_allergen_assessments"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."ingredient_allergen_assessments" FROM "anon";

ALTER TABLE "public"."food_ingredient_aliases"
  ADD CONSTRAINT "food_ingredient_aliases_ingredient_id_fkey" FOREIGN KEY (ingredient_id) REFERENCES public.food_ingredients(id) ON DELETE CASCADE;

ALTER TABLE "public"."ingredient_allergen_assessments"
  ADD CONSTRAINT "ingredient_allergen_assessments_allergen_id_fkey" FOREIGN KEY (allergen_id) REFERENCES public.allergen_taxonomy(id);

ALTER TABLE "public"."ingredient_allergen_assessments"
  ADD CONSTRAINT "ingredient_allergen_assessments_ingredient_id_fkey" FOREIGN KEY (ingredient_id) REFERENCES public.food_ingredients(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS food_ingredient_aliases_ingredient_idx ON public.food_ingredient_aliases USING btree (ingredient_id);

CREATE INDEX IF NOT EXISTS food_ingredient_aliases_lookup_idx ON public.food_ingredient_aliases USING btree (lower(TRIM(BOTH FROM alias)), LOCALE);

CREATE UNIQUE INDEX IF NOT EXISTS food_ingredients_canonical_name_idx ON public.food_ingredients USING btree (lower(TRIM(BOTH FROM canonical_name)));

CREATE INDEX IF NOT EXISTS ingredient_allergen_assessments_lookup_idx ON public.ingredient_allergen_assessments USING btree (ingredient_id, allergen_id, confidence);

CREATE INDEX IF NOT EXISTS ingredient_allergen_assessments_source_idx ON public.ingredient_allergen_assessments USING btree (source, source_id, source_version);

CREATE OR REPLACE TRIGGER allergen_taxonomy_set_updated_at
  BEFORE UPDATE ON public.allergen_taxonomy
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE OR REPLACE TRIGGER food_ingredient_aliases_set_updated_at
  BEFORE UPDATE ON public.food_ingredient_aliases
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE OR REPLACE TRIGGER food_ingredients_set_updated_at
  BEFORE UPDATE ON public.food_ingredients
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE OR REPLACE TRIGGER ingredient_allergen_assessments_set_updated_at
  BEFORE UPDATE ON public.ingredient_allergen_assessments
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

DROP POLICY IF EXISTS "allergen_taxonomy_select_authenticated" ON "public"."allergen_taxonomy";
CREATE POLICY "allergen_taxonomy_select_authenticated" ON "public"."allergen_taxonomy"
  FOR SELECT
  TO "authenticated"
  USING (true);

DROP POLICY IF EXISTS "food_ingredient_aliases_select_authenticated" ON "public"."food_ingredient_aliases";
CREATE POLICY "food_ingredient_aliases_select_authenticated" ON "public"."food_ingredient_aliases"
  FOR SELECT
  TO "authenticated"
  USING (true);

DROP POLICY IF EXISTS "food_ingredients_select_authenticated" ON "public"."food_ingredients";
CREATE POLICY "food_ingredients_select_authenticated" ON "public"."food_ingredients"
  FOR SELECT
  TO "authenticated"
  USING (true);

DROP POLICY IF EXISTS "ingredient_allergen_assessments_select_authenticated" ON "public"."ingredient_allergen_assessments";
CREATE POLICY "ingredient_allergen_assessments_select_authenticated" ON "public"."ingredient_allergen_assessments"
  FOR SELECT
  TO "authenticated"
  USING (true);

COMMENT ON COLUMN "public"."ingredient_allergen_assessments"."evidence_snapshot" IS 'Pruefbarer Quellenausschnitt oder Textsnapshot; darf bei not_detected nicht leer sein.';

COMMENT ON COLUMN "public"."ingredient_allergen_assessments"."review_scope" IS 'Dokumentiert, welcher Teil der Quelle fuer genau diese Allergengruppe geprueft wurde.';

COMMENT ON TABLE "public"."allergen_taxonomy" IS 'Die 14 Stoffgruppen aus Anhang II der Verordnung (EU) Nr. 1169/2011.';

COMMENT ON TABLE "public"."food_ingredient_aliases" IS 'Quellenbelegte Namen fuer kanonische Zutaten. Mehrdeutige Aliase muessen beim Lesen unknown bleiben.';

COMMENT ON TABLE "public"."food_ingredients" IS 'Globale kanonische Zutatenidentitaeten; fehlende Allergenpruefungen sind unknown.';

COMMENT ON TABLE "public"."ingredient_allergen_assessments" IS 'Explizite, quellenbelegte positive und negative EU-Allergenpruefungen. Keine Zeile bedeutet unknown, niemals not_detected.';

REVOKE ALL ON TABLE "public"."allergen_taxonomy" FROM "authenticated";

GRANT SELECT ON TABLE "public"."allergen_taxonomy" TO "authenticated";

REVOKE ALL ON TABLE "public"."allergen_taxonomy" FROM "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."allergen_taxonomy" TO "service_role";

REVOKE ALL ON TABLE "public"."food_ingredient_aliases" FROM "authenticated";

GRANT SELECT ON TABLE "public"."food_ingredient_aliases" TO "authenticated";

REVOKE ALL ON TABLE "public"."food_ingredient_aliases" FROM "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."food_ingredient_aliases" TO "service_role";

REVOKE ALL ON TABLE "public"."food_ingredients" FROM "authenticated";

GRANT SELECT ON TABLE "public"."food_ingredients" TO "authenticated";

REVOKE ALL ON TABLE "public"."food_ingredients" FROM "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."food_ingredients" TO "service_role";

REVOKE ALL ON TABLE "public"."ingredient_allergen_assessments" FROM "authenticated";

GRANT SELECT ON TABLE "public"."ingredient_allergen_assessments" TO "authenticated";

REVOKE ALL ON TABLE "public"."ingredient_allergen_assessments" FROM "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."ingredient_allergen_assessments" TO "service_role";
