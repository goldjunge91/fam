-- ==============================================================================
-- 23_brochures.sql
-- Tabellen fuer den Bild-Cluster-Katalog und favorisierte Maerkte
-- ==============================================================================

-- 1. Globale Markt-Definitionen (Read-Only für App)
create table public.brochure_stores (
  id text primary key,
  name text not null,
  logo_url text,
  active boolean default true not null,
  created_at timestamptz default now() not null
);

alter table public.brochure_stores enable row level security;
create policy brochure_stores_select on public.brochure_stores 
  for select to authenticated using (true);


-- 2. Favorisierte Maerkte pro Nutzer (strikt privat via RLS)
create table public.favorite_brochure_stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id text not null references public.brochure_stores(id) on delete cascade,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  deleted_at timestamptz,
  unique(user_id, store_id)
);

create index favorite_brochure_stores_store_id_idx
  on public.favorite_brochure_stores (store_id);

alter table public.favorite_brochure_stores enable row level security;
create policy favorite_brochure_stores_all on public.favorite_brochure_stores
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create trigger set_updated_at_favorite_brochure_stores
  before update on public.favorite_brochure_stores
  for each row execute function private.set_updated_at();


-- 3. Verifizierter Bild-Cluster-Katalog mit R2-Bildern und Verfuegbarkeit je PLZ
create or replace function private.canonical_brochure_pages_are_valid(
  p_pages jsonb,
  p_page_count integer
)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select case
    when pg_catalog.jsonb_typeof(p_pages) is distinct from 'array' then false
    when pg_catalog.jsonb_array_length(p_pages) <> p_page_count then false
    else not exists (
      select 1
      from pg_catalog.jsonb_array_elements(p_pages) as page(value)
      where pg_catalog.jsonb_typeof(page.value) is distinct from 'object'
        or pg_catalog.jsonb_typeof(page.value -> 'number') is distinct from 'number'
        or coalesce(page.value ->> 'number', '') !~ '^[1-9][0-9]*$'
        or pg_catalog.jsonb_typeof(page.value -> 'imageUrl') is distinct from 'string'
        or coalesce(page.value ->> 'imageUrl', '') !~ '^brochures/.+'
        or pg_catalog.jsonb_typeof(page.value -> 'hotspots') is distinct from 'array'
    )
  end;
$$;

create table public.canonical_brochures (
  id text primary key check (btrim(id) <> ''),
  canonical_brn text not null check (btrim(canonical_brn) <> ''),
  store_id text not null references public.brochure_stores(id),
  title text not null check (btrim(title) <> ''),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  page_count integer not null check (page_count > 0),
  cover_image text not null check (cover_image ~ '^brochures/.+'),
  pages jsonb not null,
  verified_sha256 text not null check (verified_sha256 ~ '^[a-f0-9]{64}$'),
  constraint canonical_brochures_validity check (valid_until >= valid_from),
  constraint canonical_brochures_pages_valid
    check (private.canonical_brochure_pages_are_valid(pages, page_count))
);

create index canonical_brochures_store_id_idx
  on public.canonical_brochures (store_id);

comment on table public.canonical_brochures is
  'Bild-Cluster mit verifiziertem SHA-256, vollstaendigen Seiten samt Hotspots und privaten R2-Objektschluesseln.';

create table public.brochure_availability (
  zip_code text not null check (zip_code ~ '^[0-9]{5}$'),
  canonical_brochure_id text not null
    references public.canonical_brochures(id) on delete cascade,
  primary key (zip_code, canonical_brochure_id)
);

create index brochure_availability_canonical_brochure_id_idx
  on public.brochure_availability (canonical_brochure_id);

comment on table public.brochure_availability is
  'Verknuepft jeden Bild-Cluster mit den PLZ, an denen er verfuegbar ist.';

alter table public.canonical_brochures enable row level security;
create policy canonical_brochures_select on public.canonical_brochures
  for select to authenticated using (true);

alter table public.brochure_availability enable row level security;
create policy brochure_availability_select on public.brochure_availability
  for select to authenticated using (true);

-- Der Katalog wird als Ganzes ersetzt. Die Transaktionssperre verhindert,
-- dass zwei gleichzeitige Veroeffentlichungen Zeilen beider Laeufe mischen.
create or replace function public.replace_canonical_brochure_catalog(
  p_records jsonb,
  p_scoped_zip_codes text[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if pg_catalog.jsonb_typeof(p_records) is distinct from 'array' then
    raise exception 'catalog_records_must_be_an_array' using errcode = '22023';
  end if;

  if p_scoped_zip_codes is null or pg_catalog.cardinality(p_scoped_zip_codes) = 0 then
    raise exception 'catalog_scope_must_contain_complete_zip_codes' using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(p_scoped_zip_codes) as scope(zip_code)
    where scope.zip_code is null or scope.zip_code !~ '^[0-9]{5}$'
  ) then
    raise exception 'catalog_scope_contains_invalid_zip_code' using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_records) as input_row(value)
    where case
      when pg_catalog.jsonb_typeof(input_row.value -> 'available_zip_codes')
        is distinct from 'array' then true
      else pg_catalog.jsonb_array_length(input_row.value -> 'available_zip_codes') = 0
    end
  ) then
    raise exception 'catalog_record_requires_available_zip_codes' using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_records) as input_row(value)
    cross join lateral pg_catalog.jsonb_array_elements_text(
      input_row.value -> 'available_zip_codes'
    ) as zip_codes(zip_code)
    where zip_codes.zip_code is null
      or not (zip_codes.zip_code = any(p_scoped_zip_codes))
  ) then
    raise exception 'catalog_record_zip_code_outside_scope' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(823491, 23);

  delete from public.brochure_availability
  where zip_code = any(p_scoped_zip_codes);

  insert into public.canonical_brochures (
    id,
    canonical_brn,
    store_id,
    title,
    valid_from,
    valid_until,
    page_count,
    cover_image,
    pages,
    verified_sha256
  )
  select
    incoming.id,
    incoming.canonical_brn,
    incoming.store_id,
    incoming.title,
    incoming.valid_from,
    incoming.valid_until,
    incoming.page_count,
    incoming.cover_image,
    incoming.pages,
    incoming.verified_sha256
  from pg_catalog.jsonb_to_recordset(p_records) as incoming (
    id text,
    canonical_brn text,
    store_id text,
    title text,
    valid_from timestamptz,
    valid_until timestamptz,
    page_count integer,
    cover_image text,
    pages jsonb,
    verified_sha256 text
  )
  on conflict (id) do update set
    canonical_brn = excluded.canonical_brn,
    store_id = excluded.store_id,
    title = excluded.title,
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until,
    page_count = excluded.page_count,
    cover_image = excluded.cover_image,
    pages = excluded.pages,
    verified_sha256 = excluded.verified_sha256;

  insert into public.brochure_availability (zip_code, canonical_brochure_id)
  select zip_codes.zip_code, incoming.id
  from pg_catalog.jsonb_to_recordset(p_records) as incoming (
    id text,
    available_zip_codes jsonb
  )
  cross join lateral pg_catalog.jsonb_array_elements_text(incoming.available_zip_codes)
    as zip_codes(zip_code);

  delete from public.canonical_brochures as brochure
  where not exists (
    select 1
    from public.brochure_availability as availability
    where availability.canonical_brochure_id = brochure.id
  );
end;
$$;

comment on function public.replace_canonical_brochure_catalog(jsonb, text[]) is
  'Veroeffentlicht Bild-Cluster und ersetzt Verfuegbarkeiten nur fuer vollstaendig gecrawlte PLZ.';
