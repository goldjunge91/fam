-- Getrennte, globale Wissensbasis fuer Ingredient-Identitaeten und Allergene.
--
-- Diese Tabellen enthalten keine Haushaltsdaten. Externe Provider liefern
-- Evidenz; die Gateway-Sicherheitsentscheidung entsteht erst aus den lokal
-- gespeicherten und spaeter geprueften Zuordnungen.

create table if not exists public.allergen_taxonomy (
  id text primary key check (id in (
    'EU_01_GLUTEN_CEREALS',
    'EU_02_CRUSTACEANS',
    'EU_03_EGGS',
    'EU_04_FISH',
    'EU_05_PEANUTS',
    'EU_06_SOYBEANS',
    'EU_07_MILK',
    'EU_08_NUTS',
    'EU_09_CELERY',
    'EU_10_MUSTARD',
    'EU_11_SESAME',
    'EU_12_SULPHITES',
    'EU_13_LUPIN',
    'EU_14_MOLLUSCS'
  )),
  canonical_name text not null check (length(trim(canonical_name)) between 1 and 160),
  legal_code text not null unique check (legal_code in (
    'annex-ii-01',
    'annex-ii-02',
    'annex-ii-03',
    'annex-ii-04',
    'annex-ii-05',
    'annex-ii-06',
    'annex-ii-07',
    'annex-ii-08',
    'annex-ii-09',
    'annex-ii-10',
    'annex-ii-11',
    'annex-ii-12',
    'annex-ii-13',
    'annex-ii-14'
  )),
  source text not null default 'eu_lmiv' check (source = 'eu_lmiv'),
  source_id text not null check (length(trim(source_id)) between 1 and 200),
  source_url text not null check (length(trim(source_url)) between 1 and 500),
  source_version text not null check (length(trim(source_version)) between 1 and 120),
  license text not null check (length(trim(license)) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.allergen_taxonomy is
  'Normative EU-LMIV Annex-II taxonomy; ingredient mappings live separately.';

create table if not exists public.external_food_ingredients (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null check (length(trim(canonical_name)) between 1 and 200),
  foodon_id text unique check (foodon_id is null or length(trim(foodon_id)) between 1 and 200),
  source text not null check (source in ('eu_lmiv', 'open_food_facts', 'foodon', 'curated')),
  source_id text not null check (length(trim(source_id)) between 1 and 240),
  source_url text not null check (length(trim(source_url)) between 1 and 500),
  source_version text not null check (length(trim(source_version)) between 1 and 120),
  license text not null check (length(trim(license)) between 1 and 160),
  allergen_resolution text not null default 'unknown'
    check (allergen_resolution in ('unknown', 'clear', 'mapped')),
  allergen_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id),
  constraint external_food_ingredient_clear_review_required check (
    allergen_resolution <> 'clear' or allergen_reviewed_at is not null
  )
);

comment on column public.external_food_ingredients.allergen_resolution is
  'unknown means no safety conclusion; clear is reviewed without a declared allergen; mapped has explicit mapping rows.';

comment on column public.external_food_ingredients.allergen_reviewed_at is
  'A clear resolution is usable only when a reviewer timestamp is present.';

create index if not exists external_food_ingredients_name_idx
  on public.external_food_ingredients (canonical_name);

create table if not exists public.external_food_aliases (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.external_food_ingredients (id) on delete cascade,
  alias text not null check (length(trim(alias)) between 1 and 200),
  locale text not null default 'de' check (length(trim(locale)) between 2 and 16),
  source text not null check (source in ('eu_lmiv', 'open_food_facts', 'foodon', 'curated')),
  source_id text not null check (length(trim(source_id)) between 1 and 240),
  source_url text not null check (length(trim(source_url)) between 1 and 500),
  source_version text not null check (length(trim(source_version)) between 1 and 120),
  license text not null check (length(trim(license)) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ingredient_id, alias, locale, source)
);

create index if not exists external_food_aliases_lookup_idx
  on public.external_food_aliases (alias, locale);

create table if not exists public.ingredient_allergen_mappings (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.external_food_ingredients (id) on delete cascade,
  allergen_id text not null references public.allergen_taxonomy (id),
  relation text not null check (relation in ('contains', 'derived_from', 'may_contain', 'exempt')),
  source text not null check (source in ('eu_lmiv', 'open_food_facts', 'foodon', 'curated')),
  source_id text not null check (length(trim(source_id)) between 1 and 240),
  source_url text not null check (length(trim(source_url)) between 1 and 500),
  source_version text not null check (length(trim(source_version)) between 1 and 120),
  license text not null check (length(trim(license)) between 1 and 160),
  confidence text not null check (confidence in ('regulatory', 'verified', 'external', 'inferred')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ingredient_id, allergen_id, relation, source, source_id),
  constraint ingredient_allergen_review_required check (
    confidence not in ('regulatory', 'verified') or reviewed_at is not null
  )
);

create index if not exists ingredient_allergen_mappings_ingredient_idx
  on public.ingredient_allergen_mappings (ingredient_id, allergen_id);

comment on table public.ingredient_allergen_mappings is
  'Provenance-bearing evidence; may_contain and inferred are never a safety clearance.';

create or replace trigger allergen_taxonomy_set_updated_at
  before update on public.allergen_taxonomy
  for each row
  execute function private.set_updated_at();

create or replace trigger external_food_ingredients_set_updated_at
  before update on public.external_food_ingredients
  for each row
  execute function private.set_updated_at();

create or replace trigger external_food_aliases_set_updated_at
  before update on public.external_food_aliases
  for each row
  execute function private.set_updated_at();

create or replace trigger ingredient_allergen_mappings_set_updated_at
  before update on public.ingredient_allergen_mappings
  for each row
  execute function private.set_updated_at();

alter table public.allergen_taxonomy enable row level security;
alter table public.external_food_ingredients enable row level security;
alter table public.external_food_aliases enable row level security;
alter table public.ingredient_allergen_mappings enable row level security;

create policy allergen_taxonomy_select_authenticated on public.allergen_taxonomy
  for select to authenticated using (true);

create policy external_food_ingredients_select_authenticated on public.external_food_ingredients
  for select to authenticated using (true);

create policy external_food_aliases_select_authenticated on public.external_food_aliases
  for select to authenticated using (true);

create policy ingredient_allergen_mappings_select_authenticated on public.ingredient_allergen_mappings
  for select to authenticated using (true);

-- Die Privilegien stehen bewusst nach den Tabellen in diesem Schema. Die
-- zentrale Privileg-Datei wird frueher geladen und darf diese Tabellen nicht
-- voraussetzen.
revoke all on public.allergen_taxonomy,
  public.external_food_ingredients,
  public.external_food_aliases,
  public.ingredient_allergen_mappings from anon, authenticated, service_role;
grant select on public.allergen_taxonomy,
  public.external_food_ingredients,
  public.external_food_aliases,
  public.ingredient_allergen_mappings to authenticated;
grant delete, insert, select, update on public.allergen_taxonomy,
  public.external_food_ingredients,
  public.external_food_aliases,
  public.ingredient_allergen_mappings to service_role;
