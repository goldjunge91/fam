CREATE TABLE "public"."child_profile_food_rules" (
  "child_profile_id"    uuid                     NOT NULL,
  "allergy_codes"       text[]                   NOT NULL DEFAULT '{}'::text[],
  "custom_allergies"    text[]                   NOT NULL DEFAULT '{}'::text[],
  "intolerance_codes"   text[]                   NOT NULL DEFAULT '{}'::text[],
  "custom_intolerances" text[]                   NOT NULL DEFAULT '{}'::text[],
  "disliked_foods"      text[]                   NOT NULL DEFAULT '{}'::text[],
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "child_profile_food_rules_allergy_codes_allowed"
    CHECK
    (((allergy_codes <@ ARRAY['gluten-containing-cereals'::text, 'crustaceans'::text, 'eggs'::text, 'fish'::text, 'peanuts'::text, 'soybeans'::text, 'milk'::text,
    'tree-nuts'::text,
    'celery'::text, 'mustard'::text, 'sesame'::text, 'sulphur-dioxide-sulphites'::text, 'lupin'::text, 'molluscs'::text]) AND (cardinality(allergy_codes) <= 14))),
  CONSTRAINT "child_profile_food_rules_custom_counts"
    CHECK (((cardinality(custom_allergies) <= 64) AND (cardinality(custom_intolerances) <= 64) AND (cardinality(disliked_foods) <= 64))),
  CONSTRAINT "child_profile_food_rules_intolerance_codes_allowed"
    CHECK
    (((intolerance_codes <@ ARRAY['lactose'::text, 'fructose-malabsorption'::text, 'sorbitol-malabsorption'::text, 'celiac-gluten'::text]) AND (cardinality(intolerance_codes) <=
    4))),
  CONSTRAINT "child_profile_food_rules_pkey" PRIMARY KEY (child_profile_id)
);

ALTER TABLE "public"."child_profile_food_rules"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."child_profile_food_rules" FROM "anon";

ALTER TABLE "public"."child_profile_food_rules"
  ADD CONSTRAINT "child_profile_food_rules_child_profile_id_fkey" FOREIGN KEY (child_profile_id) REFERENCES public.child_profiles(id) ON DELETE CASCADE;

CREATE TRIGGER child_profile_food_rules_set_updated_at
  BEFORE UPDATE ON public.child_profile_food_rules
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY "child_profile_food_rules_insert_manager" ON "public"."child_profile_food_rules"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.child_profiles child
  WHERE
    ((child.id = child_profile_food_rules.child_profile_id) AND ((child.managed_by = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_household_admin(child.household_id) AS
    is_household_admin))))));

CREATE POLICY "child_profile_food_rules_select_manager" ON "public"."child_profile_food_rules"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.child_profiles child
  WHERE
    ((child.id = child_profile_food_rules.child_profile_id) AND ((child.managed_by = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_household_admin(child.household_id) AS
    is_household_admin))))));

CREATE POLICY "child_profile_food_rules_update_manager" ON "public"."child_profile_food_rules"
  FOR UPDATE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.child_profiles child
  WHERE
    ((child.id = child_profile_food_rules.child_profile_id) AND ((child.managed_by = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_household_admin(child.household_id) AS
    is_household_admin))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.child_profiles child
  WHERE
    ((child.id = child_profile_food_rules.child_profile_id) AND ((child.managed_by = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_household_admin(child.household_id) AS
    is_household_admin))))));

COMMENT ON TABLE "public"."child_profile_food_rules" IS 'Private Lebensmittelregeln eines Kinderprofils; sichtbar nur fuer Verwaltung und serverseitige Sicherheitsprojektionen.';

REVOKE ALL ON TABLE "public"."child_profile_food_rules" FROM "authenticated";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."child_profile_food_rules" TO "authenticated";

REVOKE ALL ON TABLE "public"."child_profile_food_rules" FROM "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."child_profile_food_rules" TO "service_role";
