ALTER TABLE "public"."recipe_component_items"
  DROP CONSTRAINT "recipe_component_items_exactly_one_target";

ALTER TABLE "public"."recipe_component_items"
  DROP CONSTRAINT "recipe_component_items_grams_check";

ALTER TABLE "public"."recipe_component_items"
  DROP CONSTRAINT "recipe_component_items_quantity_check";

ALTER TABLE "public"."recipe_component_items"
  DROP CONSTRAINT "recipe_component_items_unit_check";

ALTER TABLE "public"."recipe_component_items"
  ALTER COLUMN "grams" DROP NOT NULL;

ALTER TABLE "public"."recipe_component_items"
  ALTER COLUMN "unit" DROP NOT NULL;

ALTER TABLE "public"."recipe_component_items"
  ADD CONSTRAINT "recipe_component_item_raw_input" CHECK ((((ingredient_source_type = 'import_source'::text) AND (NULLIF(TRIM(BOTH FROM source_text), ''::text) IS
    NOT NULL) AND ((unit IS NULL) OR (NULLIF(TRIM(BOTH FROM unit), ''::text) IS NOT NULL))) OR (((quantity IS NULL) OR (quantity > (0)::numeric)) AND (unit IS
    NOT NULL) AND (unit = ANY (ARRAY['g'::text, 'kg'::text, 'ml'::text, 'l'::text, 'piece'::text, 'package'::text, 'portion'::text])))));

ALTER TABLE "public"."recipe_component_items"
  ADD CONSTRAINT "recipe_component_items_exactly_one_target" CHECK ((((ingredient_source_type = 'import_source'::text) AND (NULLIF(TRIM(BOTH FROM source_text), ''::text) IS
    NOT NULL) AND (num_nonnulls(product_id, sub_component_id) = 0)) OR (num_nonnulls(product_id, sub_component_id) = 1)));

ALTER TABLE "public"."recipe_component_items"
  ADD CONSTRAINT "recipe_component_items_grams_check" CHECK (((grams IS NULL) OR (grams > (0)::numeric)));
