-- Alpha-Feedback fuer Einkaufsbereiche. Push-only: Clients schreiben Events,
-- lesen sie nie. Der manuelle Evaluation-Import arbeitet spaeter mit einer
-- separaten Supabase und ist nicht Teil des App-Schemas.

create table if not exists public.shopping_category_feedback_events (
  event_id uuid primary key,
  schema_version smallint not null check (schema_version = 1),
  taxonomy_version text not null check (taxonomy_version = 'placement-taxonomy-v2'),
  event_type text not null check (event_type in ('manual_reassign', 'reset_to_automatic')),
  input_method text not null check (input_method in ('add_form', 'edit_form')),
  household_id uuid not null references public.households (id) on delete cascade,
  actor_user_id uuid not null references public.profiles (id) on delete cascade,
  shopping_list_item_id uuid not null,
  product_key_type text not null check (product_key_type in ('product', 'barcode', 'name')),
  product_key text not null check (length(trim(product_key)) between 1 and 500),
  product_id uuid,
  barcode text check (barcode is null or barcode ~ '^[0-9]{6,32}$'),
  product_name text not null check (length(trim(product_name)) between 1 and 200),
  store_id uuid,
  preference_scope text not null check (preference_scope in ('store', 'household')),
  old_placement_zone text not null,
  new_placement_zone text not null,
  predicted_placement_zone text not null,
  old_category_source text not null,
  new_category_source text not null,
  predicted_product_family text not null,
  predicted_product_form text not null,
  classifier_version text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  app_version text not null check (length(trim(app_version)) between 1 and 100),
  build_channel text not null check (length(trim(build_channel)) between 1 and 100),
  client_created_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint shopping_category_feedback_scope_check check (
    (preference_scope = 'store' and store_id is not null)
    or (preference_scope = 'household' and store_id is null)
  ),
  constraint shopping_category_feedback_manual_change_check check (
    event_type <> 'manual_reassign' or old_placement_zone is distinct from new_placement_zone
  ),
  constraint shopping_category_feedback_key_check check (
    (product_key_type = 'product' and product_id is not null)
    or (product_key_type = 'barcode' and barcode is not null and product_key = barcode)
    or (product_key_type = 'name' and product_id is null and barcode is null)
  )
);

create index if not exists shopping_category_feedback_household_created_idx
  on public.shopping_category_feedback_events (household_id, created_at, event_id);
create index if not exists shopping_category_feedback_created_event_idx
  on public.shopping_category_feedback_events (created_at, event_type, event_id);
create index if not exists shopping_category_feedback_store_created_idx
  on public.shopping_category_feedback_events (store_id, created_at, event_id);
create index if not exists shopping_category_feedback_product_key_idx
  on public.shopping_category_feedback_events (product_key_type, product_key);

comment on table public.shopping_category_feedback_events is
  'Push-only, pseudonymisierbare Alpha-Signale fuer Einkaufsbereich-Korrekturen.';

alter table public.shopping_category_feedback_events enable row level security;

create policy shopping_category_feedback_insert_member
  on public.shopping_category_feedback_events
  for insert to authenticated
  with check (
    (select auth.uid()) = actor_user_id
    and (select private.is_household_member(household_id))
    and (
      store_id is null
      or not exists (
        select 1 from public.stores scoped_store where scoped_store.id = shopping_category_feedback_events.store_id
      )
      or exists (
        select 1
        from public.stores scoped_store
        where scoped_store.id = shopping_category_feedback_events.store_id
          and scoped_store.household_id = shopping_category_feedback_events.household_id
      )
    )
  );
