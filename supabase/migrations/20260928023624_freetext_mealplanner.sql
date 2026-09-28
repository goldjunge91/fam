ALTER TABLE "public"."meal_plan_entries"
  ADD COLUMN "custom_title" text;

ALTER TABLE "public"."meal_plan_entries"
  ADD COLUMN "custom_ingredients" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "public"."meal_plan_entries"
  ALTER COLUMN "recipe_id" DROP NOT NULL;

ALTER TABLE "public"."meal_plan_entries"
  ADD CONSTRAINT "meal_plan_entries_custom_ingredients_check" CHECK ((jsonb_typeof(custom_ingredients) = 'array'::text));

ALTER TABLE "public"."meal_plan_entries"
  ADD CONSTRAINT "meal_plan_entries_custom_title_check"
    CHECK (((custom_title IS NULL) OR ((length(TRIM(BOTH FROM custom_title)) >= 1) AND (length(TRIM(BOTH FROM custom_title)) <= 120))));

ALTER TABLE "public"."meal_plan_entries"
  ADD CONSTRAINT "meal_plan_entries_recipe_or_custom" CHECK ((((recipe_id IS
    NOT NULL) AND (custom_title IS NULL) AND (custom_ingredients = '[]'::jsonb)) OR ((recipe_id IS NULL) AND (custom_title IS NOT NULL))));

COMMENT ON TABLE "public"."meal_plan_entries" IS 'Ein Rezept oder Freitextgericht an einem Tag/einer Mahlzeit eines Wochenplans (#128). Nur Mengen (portions/people_count), keine Zuordnung zu einzelnen Haushaltsmitgliedern.';
