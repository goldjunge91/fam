SET local check_function_bodies = off;

ALTER TABLE "public"."recipe_component_items"
  ADD COLUMN "ingredient_mapping" jsonb NOT NULL DEFAULT '{"status": "unknown", "version": 1, "complete": false, "ingredientIds": []}'::jsonb;

CREATE OR REPLACE FUNCTION private.validate_recipe_component_item_ingredient_mapping()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_ingredient_ids text[];
  v_reviewed_by text;
begin
  if new.ingredient_mapping ->> 'status' <> 'verified' then
    return new;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(new.ingredient_mapping -> 'ingredientIds') as item(value)
    where jsonb_typeof(item.value) <> 'string'
      or item.value #>> '{}' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) then
    raise exception 'recipe_ingredient_mapping_invalid_ingredient_id';
  end if;

  select array_agg(value #>> '{}')
  into v_ingredient_ids
  from jsonb_array_elements(new.ingredient_mapping -> 'ingredientIds') as item(value);

  if cardinality(v_ingredient_ids) <> (
    select count(distinct ingredient_id)::integer
    from unnest(v_ingredient_ids) as ids(ingredient_id)
  ) then
    raise exception 'recipe_ingredient_mapping_duplicate_ingredient_id';
  end if;

  begin
    perform (new.ingredient_mapping ->> 'reviewedAt')::timestamptz;
  exception when others then
    raise exception 'recipe_ingredient_mapping_invalid_review_timestamp';
  end;

  if exists (
    select 1
    from unnest(v_ingredient_ids) as ids(ingredient_id)
    where not exists (
      select 1
      from public.food_ingredients ingredient
      where ingredient.id = ids.ingredient_id::uuid
    )
  ) then
    raise exception 'recipe_ingredient_mapping_ingredient_not_found';
  end if;

  v_reviewed_by := new.ingredient_mapping ->> 'reviewedBy';
  if coalesce(auth.role(), '') <> 'service_role'
    and (auth.uid() is null or v_reviewed_by <> auth.uid()::text)
  then
    raise exception 'recipe_ingredient_mapping_reviewer_must_match_user';
  end if;

  return new;
end;
$function$;

ALTER TABLE "public"."recipe_component_items"
  ADD CONSTRAINT "recipe_component_item_ingredient_mapping_shape"
    CHECK
    (((jsonb_typeof(ingredient_mapping) = 'object'::text) AND ((ingredient_mapping ->> 'version'::text) = '1'::text) AND ((ingredient_mapping ->> 'status'::text) = ANY
    (ARRAY['unknown'::text, 'verified'::text])) AND (jsonb_typeof((ingredient_mapping -> 'ingredientIds'::text)) = 'array'::text) AND
    (jsonb_typeof((ingredient_mapping -> 'complete'::text)) = 'boolean'::text) AND
CASE
    WHEN ((ingredient_mapping ->> 'status'::text) = 'verified'::text) THEN ((jsonb_array_length(
    CASE
        WHEN (jsonb_typeof((ingredient_mapping -> 'ingredientIds'::text)) = 'array'::text) THEN (ingredient_mapping -> 'ingredientIds'::text)
        ELSE '[]'::jsonb
    END) > 0) AND ((ingredient_mapping ->> 'complete'::text) = 'true'::text) AND
      (COALESCE((ingredient_mapping ->> 'source'::text), ''::text) = ANY (ARRAY['recipe_text'::text, 'product_label'::text, 'import_source'::text])) AND
      (NULLIF(TRIM(BOTH FROM (ingredient_mapping ->> 'source'::text)), ''::text) IS NOT NULL) AND (NULLIF(TRIM(BOTH FROM (ingredient_mapping ->> 'sourceId'::text)), ''::text) IS
      NOT NULL) AND (NULLIF(TRIM(BOTH FROM (ingredient_mapping ->> 'sourceVersion'::text)), ''::text) IS
      NOT NULL) AND (NULLIF(TRIM(BOTH FROM (ingredient_mapping ->> 'evidenceSnapshot'::text)), ''::text) IS
      NOT NULL) AND (NULLIF(TRIM(BOTH FROM (ingredient_mapping ->> 'reviewedAt'::text)), ''::text) IS
      NOT NULL) AND (NULLIF(TRIM(BOTH FROM (ingredient_mapping ->> 'reviewedBy'::text)), ''::text) IS
      NOT NULL) AND (COALESCE((ingredient_mapping ->> 'reviewedBy'::text), ''::text) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text))
    ELSE true
END));

CREATE TRIGGER recipe_component_items_validate_ingredient_mapping
  BEFORE INSERT OR UPDATE OF ingredient_mapping ON public.recipe_component_items
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_recipe_component_item_ingredient_mapping();

COMMENT ON COLUMN "public"."recipe_component_items"."ingredient_mapping" IS 'Haushaltsreview der Zutatenidentitaet einer Rezeptposition. Getrennt von global kuratierten Allergenfakten; fehlt ein aktueller vollstaendiger Review, bleibt die Position unknown.';

REVOKE ALL ON FUNCTION "private"."validate_recipe_component_item_ingredient_mapping"() FROM PUBLIC;
