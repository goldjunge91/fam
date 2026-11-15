SET local check_function_bodies = off;

ALTER TABLE "public"."food_ingredients"
  ADD COLUMN "revision" integer NOT NULL DEFAULT 1;

ALTER TABLE "public"."ingredient_allergen_assessments"
  ADD COLUMN "ingredient_revision" integer NOT NULL;

CREATE OR REPLACE FUNCTION private.bump_food_ingredient_revision()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'pg_catalog'
  AS $function$
begin
  if new.canonical_name is distinct from old.canonical_name then
    new.revision := old.revision + 1;
  end if;
  return new;
end;
$function$;

ALTER TABLE "public"."food_ingredients"
  ADD CONSTRAINT "food_ingredients_revision_check" CHECK ((revision > 0));

ALTER TABLE "public"."ingredient_allergen_assessments"
  ADD CONSTRAINT "ingredient_allergen_assessments_ingredient_revision_check" CHECK ((ingredient_revision > 0));

CREATE TRIGGER food_ingredients_bump_revision
  BEFORE UPDATE OF canonical_name ON public.food_ingredients
  FOR EACH ROW
  EXECUTE FUNCTION private.bump_food_ingredient_revision();

COMMENT ON COLUMN "public"."food_ingredients"."revision" IS 'Steigt bei einer Aenderung der kanonischen Identitaet; Fakten mit aelterer Revision sind stale.';

COMMENT ON COLUMN "public"."ingredient_allergen_assessments"."ingredient_revision" IS 'Revision der kanonischen Zutat zum Reviewzeitpunkt; Abweichungen markieren den Fakt als stale.';

REVOKE ALL ON FUNCTION "private"."bump_food_ingredient_revision"() FROM PUBLIC;
