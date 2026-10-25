-- ==============================================================================
-- 23_brochures.sql
-- Regionaler Prospektkatalog und favorisierte Märkte
-- ==============================================================================

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

-- The catalog stores the source URL. It is not a client-controlled download URL.
create or replace function private.bring_image_url_is_valid(p_url text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_url is null then false
    when p_url ~ '[[:space:][:cntrl:]]' then false
    when p_url ~ '%([^0-9A-Fa-f]|$)|%[0-9A-Fa-f]([^0-9A-Fa-f]|$)' then false
    when p_url ~* '%0[0-9a-f]|%1[0-9a-f]|%7f' then false
    when position(chr(92) in p_url) > 0 then false
    when split_part(p_url, '?', 1) ~* '%(2f|5c|25)' then false
    when split_part(p_url, '?', 1) ~* '(^|/)(\.|%2e){1,2}(/|$)' then false
    else p_url ~ '^https://([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+bringapi\.app/content/[^/?#[:space:]]+(/[^/?#[:space:]]+)*(\?[^#[:space:]]*)?$'
  end;
$$;

alter table public.brochure_stores
  add constraint brochure_stores_logo_url_check
  check (logo_url is null or private.bring_image_url_is_valid(logo_url));

create or replace function private.canonical_brochure_pages_are_valid(
  p_pages jsonb,
  p_page_count integer
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_pages is null or p_page_count is null then false
    when pg_catalog.jsonb_typeof(p_pages) is distinct from 'array' then false
    when p_page_count < 1 then false
    when pg_catalog.jsonb_array_length(p_pages) <> p_page_count then false
    else not exists (
      select 1
      from pg_catalog.jsonb_array_elements(p_pages) with ordinality as page(value, position)
      where pg_catalog.jsonb_typeof(page.value) is distinct from 'object'
        or pg_catalog.jsonb_typeof(page.value -> 'number') is distinct from 'number'
        or coalesce(page.value ->> 'number', '') !~ '^[1-9][0-9]*$'
        or page.value ->> 'number' <> page.position::text
        or not private.bring_image_url_is_valid(page.value ->> 'imageUrl')
        or case
          when pg_catalog.jsonb_typeof(page.value -> 'hotspots') is distinct from 'array' then true
          else exists (
            select 1
            from pg_catalog.jsonb_array_elements(page.value -> 'hotspots') as hotspot(value)
            where pg_catalog.jsonb_typeof(hotspot.value) is distinct from 'object'
              or (
                hotspot.value ? 'imageUrl'
                and not private.bring_image_url_is_valid(hotspot.value ->> 'imageUrl')
              )
          )
        end
    )
  end;
$$;

create table public.canonical_brochures (
  id text primary key check (btrim(id) <> ''),
  canonical_brn text not null check (btrim(canonical_brn) <> ''),
  source_zip_code text not null check (source_zip_code ~ '^[0-9]{5}$'),
  store_id text not null references public.brochure_stores(id),
  title text not null check (btrim(title) <> ''),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  page_count integer not null check (page_count > 0),
  cover_image text not null check (private.bring_image_url_is_valid(cover_image)),
  pages jsonb not null,
  constraint canonical_brochures_validity check (valid_until >= valid_from),
  constraint canonical_brochures_pages_valid
    check (private.canonical_brochure_pages_are_valid(pages, page_count))
);

create index canonical_brochures_store_id_idx
  on public.canonical_brochures (store_id);
create index canonical_brochures_region_idx
  on public.canonical_brochures (source_zip_code, canonical_brn);

comment on table public.canonical_brochures is
  'Regionaler Prospektkatalog mit vollständigen Seiten, Hotspots und originalen Bring-Quell-URLs.';
comment on column public.canonical_brochures.source_zip_code is
  'PLZ des Detailabrufs für die konkrete regionale Ausgabe.';

create table public.brochure_availability (
  zip_code text not null check (zip_code ~ '^[0-9]{5}$'),
  canonical_brochure_id text not null
    references public.canonical_brochures(id) on delete cascade,
  primary key (zip_code, canonical_brochure_id)
);

create index brochure_availability_canonical_brochure_id_idx
  on public.brochure_availability (canonical_brochure_id);

comment on table public.brochure_availability is
  'Verknüpft eine konkrete regionale Ausgabe ausschließlich mit belegten PLZ.';

alter table public.canonical_brochures enable row level security;
create policy canonical_brochures_select on public.canonical_brochures
  for select to authenticated using (true);

alter table public.brochure_availability enable row level security;
create policy brochure_availability_select on public.brochure_availability
  for select to authenticated using (true);

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

  if pg_catalog.cardinality(p_scoped_zip_codes) <> (
    select count(distinct scope.zip_code)::integer
    from pg_catalog.unnest(p_scoped_zip_codes) as scope(zip_code)
  ) then
    raise exception 'catalog_scope_contains_duplicate_zip_code' using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_records) as input_row(value)
    where case
      when pg_catalog.jsonb_typeof(input_row.value -> 'available_zip_codes') is distinct from 'array'
        then true
      when pg_catalog.jsonb_array_length(input_row.value -> 'available_zip_codes') <> 1
        then true
      else input_row.value -> 'source_zip_code' is distinct from
           input_row.value -> 'available_zip_codes' -> 0
    end
  ) then
    raise exception 'catalog_record_requires_one_matching_source_zip_code' using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_records) as input_row(value)
    where input_row.value ->> 'source_zip_code' is null
      or not (input_row.value ->> 'source_zip_code' = any(p_scoped_zip_codes))
  ) then
    raise exception 'catalog_record_zip_code_outside_scope' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(823491, 23);

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(p_records) as incoming (id text, source_zip_code text)
    join public.canonical_brochures as existing using (id)
    where existing.source_zip_code <> incoming.source_zip_code
  ) then
    raise exception 'catalog_record_region_identity_changed' using errcode = '22023';
  end if;

  delete from public.brochure_availability
  where zip_code = any(p_scoped_zip_codes);

  insert into public.canonical_brochures (
    id,
    canonical_brn,
    source_zip_code,
    store_id,
    title,
    valid_from,
    valid_until,
    page_count,
    cover_image,
    pages
  )
  select
    incoming.id,
    incoming.canonical_brn,
    incoming.source_zip_code,
    incoming.store_id,
    incoming.title,
    incoming.valid_from,
    incoming.valid_until,
    incoming.page_count,
    incoming.cover_image,
    incoming.pages
  from pg_catalog.jsonb_to_recordset(p_records) as incoming (
    id text,
    canonical_brn text,
    source_zip_code text,
    store_id text,
    title text,
    valid_from timestamptz,
    valid_until timestamptz,
    page_count integer,
    cover_image text,
    pages jsonb,
    available_zip_codes jsonb
  )
  on conflict (id) do update set
    canonical_brn = excluded.canonical_brn,
    source_zip_code = excluded.source_zip_code,
    store_id = excluded.store_id,
    title = excluded.title,
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until,
    page_count = excluded.page_count,
    cover_image = excluded.cover_image,
    pages = excluded.pages;

  insert into public.brochure_availability (zip_code, canonical_brochure_id)
  select incoming.source_zip_code, incoming.id
  from pg_catalog.jsonb_to_recordset(p_records) as incoming (
    id text,
    source_zip_code text
  );

  delete from public.canonical_brochures as brochure
  where not exists (
    select 1
    from public.brochure_availability as availability
    where availability.canonical_brochure_id = brochure.id
  );
end;
$$;

comment on function public.replace_canonical_brochure_catalog(jsonb, text[]) is
  'Ersetzt regionale Prospektmetadaten und belegte PLZ atomar für den vollständigen Crawl-Scope.';
