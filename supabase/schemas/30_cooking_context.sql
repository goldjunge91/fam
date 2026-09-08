-- Deklarative Funktion fuer den konsolidierten Koch-Kontext.
--
-- Ersetzt den vorherigen 13-fachen PostgREST-HTTP-Wasserfall im AI-Gateway
-- durch einen einzelnen, atomaren und performanten DB-Aufruf gemaess
-- docs/specs/edge-functions-hardening.md Abschnitt 4.6.

create or replace function public.get_cooking_context(p_household_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_inventory_lots jsonb;
  v_shopping_items jsonb;
  v_allergies jsonb;
  v_forbidden jsonb;
  v_recipes jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.household_members
    where household_id = p_household_id
      and user_id = v_user_id
  ) then
    raise exception 'household_forbidden' using errcode = '42501';
  end if;

  -- 1. Inventory lots
  select coalesce(
    jsonb_agg(
      lot_obj
      order by
        case when best_before_val is not null then 0 else 1 end,
        best_before_val asc nulls last,
        normalized_name asc,
        lot_id asc
    ),
    '[]'::jsonb
  )
  into v_inventory_lots
  from (
    select
      fi.id as lot_id,
      trim(fi.name) as normalized_name,
      to_char(fi.expiry_date, 'YYYY-MM-DD') as best_before_val,
      jsonb_build_object(
        'lotId', fi.id,
        'productId', fi.product_id,
        'normalizedName', trim(fi.name),
        'quantity', fi.quantity,
        'unit', fi.unit,
        'bestBefore', to_char(fi.expiry_date, 'YYYY-MM-DD'),
        'useBy', null,
        'storage', case
          when sl.kind in ('fridge', 'freezer', 'pantry') then sl.kind
          else 'unknown'
        end
      ) as lot_obj
    from public.fridge_items fi
    left join public.storage_locations sl on sl.id = fi.location_id
    where fi.household_id = p_household_id
      and fi.deleted_at is null
      and fi.quantity > 0
      and length(trim(fi.name)) > 0
  ) sub_lots;

  -- 2. Shopping items
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'shoppingItemId', sli.id,
        'name', trim(sli.name),
        'quantity', coalesce(sli.quantity, 1),
        'unit', coalesce(sli.unit, 'piece')
      )
      order by sli.created_at asc
    ),
    '[]'::jsonb
  )
  into v_shopping_items
  from public.shopping_list_items sli
  where sli.household_id = p_household_id
    and sli.deleted_at is null
    and sli.checked_at is null
    and sli.quantity > 0
    and length(trim(sli.name)) > 0;

  -- 3. Food rules of requesting user
  select
    coalesce(
      (
        select jsonb_agg(rule_val)
        from (
          select unnest(
            coalesce(pfr.allergy_codes, '{}'::text[]) ||
            coalesce(pfr.custom_allergies, '{}'::text[]) ||
            coalesce(pfr.intolerance_codes, '{}'::text[]) ||
            coalesce(pfr.custom_intolerances, '{}'::text[])
          ) as rule_val
        ) u
      ),
      '[]'::jsonb
    ),
    coalesce(to_jsonb(pfr.disliked_foods), '[]'::jsonb)
  into v_allergies, v_forbidden
  from public.profile_food_rules pfr
  where pfr.user_id = v_user_id;

  v_allergies := coalesce(v_allergies, '[]'::jsonb);
  v_forbidden := coalesce(v_forbidden, '[]'::jsonb);

  -- 4. Catalog recipes with ingredients, steps, and allergen projections
  with published_recipes as (
    select
      cr.id,
      trim(cr.title) as title,
      cr.cook_time_minutes,
      cr.default_servings,
      cr.dietary_tags,
      cr.sort_order
    from public.catalog_recipes cr
    where cr.status = 'published'
  ),
  recipe_raw_items as (
    select
      ci.recipe_id,
      ci.position,
      ci.product_id,
      coalesce(
        nullif(trim(ci.ingredient_name), ''),
        nullif(trim(p.name), '')
      ) as resolved_name,
      coalesce(ci.quantity, ci.grams) as qty,
      case
        when ci.quantity is not null and ci.unit is not null then ci.unit
        when coalesce(ci.quantity, ci.grams) is not null then 'g'
        else null
      end as resolved_unit
    from public.catalog_recipe_component_items ci
    join published_recipes pr on pr.id = ci.recipe_id
    left join public.products p on p.id = ci.product_id
  ),
  recipe_incomplete_items as (
    select distinct recipe_id
    from recipe_raw_items
    where resolved_name is null or length(resolved_name) = 0
  ),
  recipe_items_agg as (
    select
      rri.recipe_id,
      jsonb_agg(
        jsonb_build_object(
          'productId', rri.product_id,
          'normalizedName', rri.resolved_name,
          'quantity', rri.qty,
          'unit', rri.resolved_unit
        )
        order by rri.position asc
      ) as ingredients
    from recipe_raw_items rri
    where not exists (select 1 from recipe_incomplete_items rii where rii.recipe_id = rri.recipe_id)
    group by rri.recipe_id
  ),
  recipe_raw_steps as (
    select
      rs.recipe_id,
      rs.position,
      trim(rs.text) as step_text
    from public.catalog_recipe_steps rs
    join published_recipes pr on pr.id = rs.recipe_id
  ),
  recipe_incomplete_steps as (
    select distinct recipe_id
    from recipe_raw_steps
    where step_text is null or length(step_text) = 0
  ),
  recipe_steps_agg as (
    select
      rrs.recipe_id,
      jsonb_agg(to_jsonb(rrs.step_text) order by rrs.position asc) as steps
    from recipe_raw_steps rrs
    where not exists (select 1 from recipe_incomplete_steps ris where ris.recipe_id = rrs.recipe_id)
    group by rrs.recipe_id
  ),
  recipe_all_items as (
    select distinct
      ci.recipe_id,
      ci.id as item_id
    from public.catalog_recipe_component_items ci
    join published_recipes pr on pr.id = ci.recipe_id
  ),
  recipe_item_links as (
    select distinct ci.recipe_id, ci.id as item_id, cl.ingredient_id
    from public.catalog_recipe_component_items ci
    join published_recipes pr on pr.id = ci.recipe_id
    join public.catalog_recipe_item_ingredient_links cl on cl.catalog_item_id = ci.id
    union
    select distinct ci.recipe_id, ci.id as item_id, pil.ingredient_id
    from public.catalog_recipe_component_items ci
    join published_recipes pr on pr.id = ci.recipe_id
    join public.product_ingredient_links pil on pil.product_id = ci.product_id
    where ci.product_id is not null
  ),
  recipe_item_evidence as (
    select
      rai.recipe_id,
      rai.item_id,
      ril.ingredient_id,
      case
        when ril.ingredient_id is null then false
        when efi.id is null or efi.allergen_resolution is null or efi.allergen_resolution = 'unknown' then false
        when efi.allergen_resolution = 'clear' then
          efi.allergen_reviewed_at is not null
          and not exists (
            select 1 from public.ingredient_allergen_mappings iam
            where iam.ingredient_id = efi.id
          )
        when efi.allergen_resolution = 'mapped' then
          exists (
            select 1 from public.ingredient_allergen_mappings iam
            where iam.ingredient_id = efi.id
          )
          and not exists (
            select 1 from public.ingredient_allergen_mappings iam
            where iam.ingredient_id = efi.id
              and (iam.reviewed_at is null or iam.confidence not in ('regulatory', 'verified'))
          )
        else false
      end as is_valid
    from recipe_all_items rai
    left join recipe_item_links ril on ril.recipe_id = rai.recipe_id and ril.item_id = rai.item_id
    left join public.external_food_ingredients efi on efi.id = ril.ingredient_id
  ),
  recipe_allergen_status as (
    select
      pr.id as recipe_id,
      count(distinct rai.item_id) as total_items,
      count(distinct case when rie.is_valid then rie.item_id end) as valid_items,
      bool_and(coalesce(rie.is_valid, false)) as all_links_valid
    from published_recipes pr
    left join recipe_all_items rai on rai.recipe_id = pr.id
    left join recipe_item_evidence rie on rie.recipe_id = pr.id
    group by pr.id
  ),
  recipe_projected_allergens as (
    select
      ras.recipe_id,
      case
        when ras.total_items = 0 or ras.valid_items < ras.total_items or not coalesce(ras.all_links_valid, false) then null
        else coalesce(
          (
            select jsonb_agg(
              m.allergen_id
              order by array_position(array[
                'EU_01_GLUTEN_CEREALS', 'EU_02_CRUSTACEANS', 'EU_03_EGGS', 'EU_04_FISH',
                'EU_05_PEANUTS', 'EU_06_SOYBEANS', 'EU_07_MILK', 'EU_08_NUTS',
                'EU_09_CELERY', 'EU_10_MUSTARD', 'EU_11_SESAME', 'EU_12_SULPHITES',
                'EU_13_LUPIN', 'EU_14_MOLLUSCS'
              ], m.allergen_id)
            )
            from (
              select distinct iam.allergen_id
              from recipe_item_links ril2
              join public.ingredient_allergen_mappings iam on iam.ingredient_id = ril2.ingredient_id
              where ril2.recipe_id = ras.recipe_id
                and iam.relation <> 'exempt'
            ) m
          ),
          '[]'::jsonb
        )
      end as allergens
    from recipe_allergen_status ras
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'recipeId', pr.id,
        'title', pr.title,
        'source', 'catalog',
        'estimatedMinutes', pr.cook_time_minutes,
        'servings', pr.default_servings,
        'dietaryTags', coalesce(to_jsonb(pr.dietary_tags), '[]'::jsonb),
        'allergens', rpa.allergens,
        'ingredients', coalesce(ria.ingredients, '[]'::jsonb),
        'steps', coalesce(rsa.steps, '[]'::jsonb)
      )
      order by pr.sort_order asc, pr.title asc
    ),
    '[]'::jsonb
  )
  into v_recipes
  from published_recipes pr
  left join recipe_items_agg ria on ria.recipe_id = pr.id
  left join recipe_steps_agg rsa on rsa.recipe_id = pr.id
  left join recipe_projected_allergens rpa on rpa.recipe_id = pr.id;

  return jsonb_build_object(
    'inventory', jsonb_build_object(
      'source', 'inventory',
      'fetchedAt', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'lots', v_inventory_lots
    ),
    'recipes', v_recipes,
    'allergies', v_allergies,
    'preferences', '[]'::jsonb,
    'forbiddenIngredients', v_forbidden,
    'shoppingItems', v_shopping_items
  );
end;
$$;
