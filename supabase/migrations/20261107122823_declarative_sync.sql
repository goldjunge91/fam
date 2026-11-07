SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.chef_recipe_response_is_valid (
  p_response jsonb
)
  RETURNS boolean
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO 'pg_catalog'
  AS $function$
declare
  v_meal jsonb;
  v_item jsonb;
  v_key_count integer;
begin
  if p_response is null
    or pg_catalog.jsonb_typeof(p_response) is distinct from 'object'
  then
    return false;
  end if;

  select count(*) into v_key_count from pg_catalog.jsonb_object_keys(p_response);
  if v_key_count <> 2
    or not (p_response ?& array['schema_version', 'meals'])
    or pg_catalog.jsonb_typeof(p_response -> 'schema_version') is distinct from 'number'
    or p_response ->> 'schema_version' <> '1'
    or pg_catalog.jsonb_typeof(p_response -> 'meals') is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_response -> 'meals') not between 1 and 3
  then
    return false;
  end if;

  for v_meal in
    select value from pg_catalog.jsonb_array_elements(p_response -> 'meals') as meal(value)
  loop
    if pg_catalog.jsonb_typeof(v_meal) is distinct from 'object' then
      return false;
    end if;

    select count(*) into v_key_count from pg_catalog.jsonb_object_keys(v_meal);
    if v_key_count not in (8, 9)
      or not (v_meal ?& array[
        'title', 'source', 'recipe_id', 'servings', 'used_items',
        'additional_ingredients', 'steps', 'notes'
      ])
      or (v_key_count = 8 and (v_meal ? 'shopping_needs'))
      or (v_key_count = 9 and not (v_meal ? 'shopping_needs'))
      or pg_catalog.jsonb_typeof(v_meal -> 'title') is distinct from 'string'
      or pg_catalog.btrim(v_meal ->> 'title') = ''
      or pg_catalog.jsonb_typeof(v_meal -> 'source') is distinct from 'string'
      or v_meal ->> 'source' not in ('catalog', 'template', 'model_generated')
      or pg_catalog.jsonb_typeof(v_meal -> 'recipe_id') not in ('null', 'string')
      or (
        pg_catalog.jsonb_typeof(v_meal -> 'recipe_id') = 'string'
        and pg_catalog.btrim(v_meal ->> 'recipe_id') = ''
      )
      or (
        v_meal ->> 'source' = 'model_generated'
        and pg_catalog.jsonb_typeof(v_meal -> 'recipe_id') is distinct from 'null'
      )
      or (
        v_meal ->> 'source' <> 'model_generated'
        and pg_catalog.jsonb_typeof(v_meal -> 'recipe_id') is distinct from 'string'
      )
      or pg_catalog.jsonb_typeof(v_meal -> 'servings') is distinct from 'number'
      or (v_meal ->> 'servings')::numeric <= 0
      or trunc((v_meal ->> 'servings')::numeric) <> (v_meal ->> 'servings')::numeric
      or pg_catalog.jsonb_typeof(v_meal -> 'used_items') is distinct from 'array'
      or pg_catalog.jsonb_typeof(v_meal -> 'additional_ingredients') is distinct from 'array'
      or pg_catalog.jsonb_array_length(v_meal -> 'additional_ingredients') > 2
      or pg_catalog.jsonb_typeof(v_meal -> 'steps') is distinct from 'array'
      or pg_catalog.jsonb_array_length(v_meal -> 'steps') < 1
      or pg_catalog.jsonb_typeof(v_meal -> 'notes') is distinct from 'array'
    then
      return false;
    end if;

    for v_item in
      select value from pg_catalog.jsonb_array_elements(v_meal -> 'used_items') as item(value)
    loop
      if pg_catalog.jsonb_typeof(v_item) is distinct from 'object' then
        return false;
      end if;
      select count(*) into v_key_count from pg_catalog.jsonb_object_keys(v_item);
      if v_key_count <> 3
        or not (v_item ?& array['inventory_item_id', 'quantity', 'unit'])
        or pg_catalog.jsonb_typeof(v_item -> 'inventory_item_id') is distinct from 'string'
        or pg_catalog.btrim(v_item ->> 'inventory_item_id') = ''
        or pg_catalog.jsonb_typeof(v_item -> 'quantity') is distinct from 'number'
        or (v_item ->> 'quantity')::numeric <= 0
        or pg_catalog.jsonb_typeof(v_item -> 'unit') is distinct from 'string'
        or pg_catalog.btrim(v_item ->> 'unit') = ''
      then
        return false;
      end if;
    end loop;

    if v_meal ? 'shopping_needs' then
      if pg_catalog.jsonb_typeof(v_meal -> 'shopping_needs') is distinct from 'array' then
        return false;
      end if;
      for v_item in
        select value
        from pg_catalog.jsonb_array_elements(v_meal -> 'shopping_needs') as item(value)
      loop
        if pg_catalog.jsonb_typeof(v_item) is distinct from 'object' then
          return false;
        end if;
        select count(*) into v_key_count from pg_catalog.jsonb_object_keys(v_item);
        if v_key_count <> 3
          or not (v_item ?& array['name', 'quantity', 'unit'])
          or pg_catalog.jsonb_typeof(v_item -> 'name') is distinct from 'string'
          or pg_catalog.btrim(v_item ->> 'name') = ''
          or pg_catalog.jsonb_typeof(v_item -> 'quantity') is distinct from 'number'
          or (v_item ->> 'quantity')::numeric <= 0
          or pg_catalog.jsonb_typeof(v_item -> 'unit') is distinct from 'string'
          or pg_catalog.btrim(v_item ->> 'unit') = ''
        then
          return false;
        end if;
      end loop;
    end if;

    for v_item in
      select value
      from pg_catalog.jsonb_array_elements(v_meal -> 'additional_ingredients') as item(value)
    loop
      if pg_catalog.jsonb_typeof(v_item) is distinct from 'string'
        or pg_catalog.btrim(v_item #>> '{}') = ''
      then
        return false;
      end if;
    end loop;

    for v_item in
      select value from pg_catalog.jsonb_array_elements(v_meal -> 'steps') as item(value)
    loop
      if pg_catalog.jsonb_typeof(v_item) is distinct from 'string'
        or pg_catalog.btrim(v_item #>> '{}') = ''
      then
        return false;
      end if;
    end loop;

    for v_item in
      select value from pg_catalog.jsonb_array_elements(v_meal -> 'notes') as item(value)
    loop
      if pg_catalog.jsonb_typeof(v_item) is distinct from 'string' then
        return false;
      end if;
    end loop;
  end loop;

  return true;
end;
$function$;
