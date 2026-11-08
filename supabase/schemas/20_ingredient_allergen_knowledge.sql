-- Gemeinsame Zutatenidentitaeten und quellenbelegte EU-Allergenpruefungen.
-- Zutaten- und Allergenfakten sind global kuratiert und fuer Clients read-only.

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
  sort_order smallint not null unique check (sort_order between 1 and 14),
  legal_name_de text not null check (length(trim(legal_name_de)) between 1 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.allergen_taxonomy is
  'Die 14 Stoffgruppen aus Anhang II der Verordnung (EU) Nr. 1169/2011.';

create table if not exists public.food_ingredients (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null check (length(trim(canonical_name)) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists food_ingredients_canonical_name_idx
  on public.food_ingredients (lower(trim(canonical_name)));

comment on table public.food_ingredients is
  'Globale kanonische Zutatenidentitaeten; fehlende Allergenpruefungen sind unknown.';

create table if not exists public.food_ingredient_aliases (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.food_ingredients (id) on delete cascade,
  alias text not null check (length(trim(alias)) between 1 and 200),
  locale text not null default 'de',
  source text not null check (source in (
    'curated', 'eu_lmiv', 'open_food_facts', 'foodon'
  )),
  source_id text not null check (length(trim(source_id)) between 1 and 240),
  source_url text not null check (length(trim(source_url)) between 1 and 500),
  source_version text not null check (length(trim(source_version)) between 1 and 120),
  license text not null check (length(trim(license)) between 1 and 160),
  confidence text not null check (confidence in ('verified', 'external', 'inferred', 'pending')),
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_ingredient_alias_verified_review_required check (
    confidence <> 'verified'
    or (reviewed_at is not null and length(trim(coalesce(reviewed_by, ''))) > 0)
  )
);

create index if not exists food_ingredient_aliases_lookup_idx
  on public.food_ingredient_aliases (lower(trim(alias)), locale);
create index if not exists food_ingredient_aliases_ingredient_idx
  on public.food_ingredient_aliases (ingredient_id);

comment on table public.food_ingredient_aliases is
  'Quellenbelegte Namen fuer kanonische Zutaten. Mehrdeutige Aliase muessen beim Lesen unknown bleiben.';

create table if not exists public.ingredient_allergen_assessments (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.food_ingredients (id) on delete cascade,
  allergen_id text not null references public.allergen_taxonomy (id),
  assessment text not null check (assessment in (
    'contains', 'derived_from', 'may_contain', 'not_detected'
  )),
  source text not null check (source in (
    'curated', 'eu_lmiv', 'open_food_facts', 'foodon'
  )),
  source_id text not null check (length(trim(source_id)) between 1 and 240),
  source_url text not null check (length(trim(source_url)) between 1 and 500),
  source_version text not null check (length(trim(source_version)) between 1 and 120),
  license text not null check (length(trim(license)) between 1 and 160),
  review_scope text not null check (length(trim(review_scope)) between 1 and 1000),
  evidence_snapshot text not null check (length(trim(evidence_snapshot)) between 1 and 12000),
  evidence_sha256 text check (
    evidence_sha256 is null or evidence_sha256 ~ '^[0-9a-f]{64}$'
  ),
  confidence text not null check (confidence in ('verified', 'external', 'inferred', 'pending')),
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ingredient_allergen_verified_review_required check (
    confidence <> 'verified'
    or (reviewed_at is not null and length(trim(coalesce(reviewed_by, ''))) > 0)
  ),
  constraint ingredient_allergen_not_detected_must_be_verified check (
    assessment <> 'not_detected' or confidence = 'verified'
  ),
  unique (ingredient_id, allergen_id, source, source_id, source_version)
);

create index if not exists ingredient_allergen_assessments_lookup_idx
  on public.ingredient_allergen_assessments (ingredient_id, allergen_id, confidence);
create index if not exists ingredient_allergen_assessments_source_idx
  on public.ingredient_allergen_assessments (source, source_id, source_version);

comment on table public.ingredient_allergen_assessments is
  'Explizite, quellenbelegte positive und negative EU-Allergenpruefungen. Keine Zeile bedeutet unknown, niemals not_detected.';
comment on column public.ingredient_allergen_assessments.review_scope is
  'Dokumentiert, welcher Teil der Quelle fuer genau diese Allergengruppe geprueft wurde.';
comment on column public.ingredient_allergen_assessments.evidence_snapshot is
  'Pruefbarer Quellenausschnitt oder Textsnapshot; darf bei not_detected nicht leer sein.';

create or replace trigger allergen_taxonomy_set_updated_at
  before update on public.allergen_taxonomy
  for each row execute function private.set_updated_at();
create or replace trigger food_ingredients_set_updated_at
  before update on public.food_ingredients
  for each row execute function private.set_updated_at();
create or replace trigger food_ingredient_aliases_set_updated_at
  before update on public.food_ingredient_aliases
  for each row execute function private.set_updated_at();
create or replace trigger ingredient_allergen_assessments_set_updated_at
  before update on public.ingredient_allergen_assessments
  for each row execute function private.set_updated_at();

alter table public.allergen_taxonomy enable row level security;
alter table public.food_ingredients enable row level security;
alter table public.food_ingredient_aliases enable row level security;
alter table public.ingredient_allergen_assessments enable row level security;

create policy allergen_taxonomy_select_authenticated on public.allergen_taxonomy
  for select to authenticated using (true);
create policy food_ingredients_select_authenticated on public.food_ingredients
  for select to authenticated using (true);
create policy food_ingredient_aliases_select_authenticated on public.food_ingredient_aliases
  for select to authenticated using (true);
create policy ingredient_allergen_assessments_select_authenticated
  on public.ingredient_allergen_assessments
  for select to authenticated using (true);
