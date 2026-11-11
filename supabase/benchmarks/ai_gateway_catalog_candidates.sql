\set ON_ERROR_STOP on
\pset pager off

-- Reproduces the Product-based AI-Gateway candidate lookup against 12,000
-- published recipes and 60,000 ingredient rows. Product 1 occurs in 600
-- distinct recipes and has repeated rows in part of that set.
--
-- Run against the disposable local Supabase database only:
--   docker exec -i "$(docker ps --filter name=supabase_db_ --format '{{.Names}}' | head -1)" \
--     psql -U postgres -d postgres \
--     < supabase/benchmarks/ai_gateway_catalog_candidates.sql

begin;
set local statement_timeout = '30s';

insert into public.products (id, name)
select
  md5('ai-gateway-benchmark-product-' || product_number::text)::uuid,
  'AI-Gateway Benchmark Product ' || product_number::text
from generate_series(1, 100) as product_number;

insert into public.catalog_recipes (
  id,
  external_id,
  slug,
  title,
  status,
  sort_order
)
select
  md5('ai-gateway-benchmark-recipe-' || recipe_number::text)::uuid,
  'ai-gateway-benchmark:' || recipe_number::text,
  'ai-gateway-benchmark-' || recipe_number::text,
  'AI-Gateway Benchmark Recipe ' || lpad(recipe_number::text, 5, '0'),
  'published',
  recipe_number
from generate_series(1, 12000) as recipe_number;

insert into public.catalog_recipe_components (id, recipe_id, name, position)
select
  md5('ai-gateway-benchmark-component-' || recipe_number::text)::uuid,
  md5('ai-gateway-benchmark-recipe-' || recipe_number::text)::uuid,
  'Hauptzutat',
  0
from generate_series(1, 12000) as recipe_number;

insert into public.catalog_recipe_component_items (
  id,
  component_id,
  recipe_id,
  product_id,
  grams,
  quantity,
  unit,
  position
)
select
  md5(
    'ai-gateway-benchmark-item-' || recipe_number::text || '-' || item_position::text
  )::uuid,
  md5('ai-gateway-benchmark-component-' || recipe_number::text)::uuid,
  md5('ai-gateway-benchmark-recipe-' || recipe_number::text)::uuid,
  md5(
    'ai-gateway-benchmark-product-' ||
    case
      when recipe_number % 100 = 0 and item_position <= 3 then '1'
      else (((recipe_number + item_position - 1) % 100) + 1)::text
    end
  )::uuid,
  100,
  1,
  'piece',
  item_position - 1
from generate_series(1, 12000) as recipe_number
cross join generate_series(1, 5) as item_position;

analyze public.catalog_recipes;
analyze public.catalog_recipe_component_items;

set local role authenticated;

create function pg_temp.ai_gateway_catalog_candidate_plan(target_product_id uuid)
returns jsonb
language plpgsql
as $$
declare
  query_plan jsonb;
begin
  execute $query$
    explain (analyze, buffers, format json)
    select
      recipe.id,
      recipe.title,
      recipe.cook_time_minutes,
      recipe.default_servings,
      recipe.dietary_tags,
      recipe.sort_order
    from public.catalog_recipes as recipe
    where recipe.status = 'published'
      and exists (
        select 1
        from public.catalog_recipe_component_items as matched_item
        where matched_item.recipe_id = recipe.id
          and matched_item.product_id = $1
      )
    order by recipe.sort_order, recipe.title, recipe.id
    limit 500
  $query$ into query_plan using target_product_id;

  return query_plan;
end;
$$;

create temporary table ai_gateway_catalog_benchmark_plan (query_plan jsonb) on commit drop;
insert into ai_gateway_catalog_benchmark_plan (query_plan)
select pg_temp.ai_gateway_catalog_candidate_plan(
  md5('ai-gateway-benchmark-product-1')::uuid
);

do $$
declare
  matching_item_count integer;
  matching_recipe_count integer;
  selected_count integer;
  distinct_count integer;
  query_plan jsonb;
begin
  select count(*), count(distinct matched_item.recipe_id)
  into matching_item_count, matching_recipe_count
  from public.catalog_recipe_component_items as matched_item
  where matched_item.product_id = md5('ai-gateway-benchmark-product-1')::uuid;

  if matching_item_count <> 840 or matching_recipe_count <> 600 then
    raise exception
      'expected 840 matching rows across 600 recipes, got % rows across % recipes',
      matching_item_count,
      matching_recipe_count;
  end if;

  select count(*), count(distinct candidate.id)
  into selected_count, distinct_count
  from (
    select recipe.id
    from public.catalog_recipes as recipe
    where recipe.status = 'published'
      and exists (
        select 1
        from public.catalog_recipe_component_items as matched_item
        where matched_item.recipe_id = recipe.id
          and matched_item.product_id = md5('ai-gateway-benchmark-product-1')::uuid
      )
    order by recipe.sort_order, recipe.title, recipe.id
    limit 500
  ) as candidate;

  if selected_count <> 500 or distinct_count <> 500 then
    raise exception
      'expected 500 distinct bounded candidates, got % rows and % distinct recipes',
      selected_count,
      distinct_count;
  end if;

  select benchmark.query_plan
  into query_plan
  from ai_gateway_catalog_benchmark_plan as benchmark;

  if query_plan::text not like '%catalog_recipe_items_product_recipe_position_idx%' then
    raise exception 'Product candidate plan did not use the declared Product/recipe index';
  end if;
end;
$$;

select
  12000 as fixture_recipes,
  60000 as fixture_ingredient_rows,
  (
    select count(*)
    from public.catalog_recipe_component_items as matched_item
    where matched_item.product_id = md5('ai-gateway-benchmark-product-1')::uuid
  ) as matching_item_rows,
  (
    select count(distinct matched_item.recipe_id)
    from public.catalog_recipe_component_items as matched_item
    where matched_item.product_id = md5('ai-gateway-benchmark-product-1')::uuid
  ) as matching_recipes,
  500 as bounded_distinct_candidates,
  (query_plan #>> '{0,Planning Time}')::numeric as planning_time_ms,
  (query_plan #>> '{0,Execution Time}')::numeric as execution_time_ms,
  (query_plan #>> '{0,Plan,Shared Hit Blocks}')::integer as shared_hit_blocks,
  (query_plan #>> '{0,Plan,Shared Read Blocks}')::integer as shared_read_blocks
from ai_gateway_catalog_benchmark_plan;

with recursive plan_nodes as (
  select query_plan -> 0 -> 'Plan' as node
  from ai_gateway_catalog_benchmark_plan

  union all

  select child.node
  from plan_nodes
  cross join lateral jsonb_array_elements(coalesce(plan_nodes.node -> 'Plans', '[]'))
    as child(node)
)
select
  node ->> 'Node Type' as node_type,
  node ->> 'Index Name' as index_name,
  (node ->> 'Actual Rows')::integer as actual_rows,
  (node ->> 'Actual Total Time')::numeric as actual_total_time_ms
from plan_nodes
where node ->> 'Index Name' = 'catalog_recipe_items_product_recipe_position_idx';

reset role;
rollback;

-- Restore statistics for the post-rollback local data set.
analyze public.catalog_recipes;
analyze public.catalog_recipe_component_items;
