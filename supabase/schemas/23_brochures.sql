-- ==============================================================================
-- 23_brochures.sql
-- KaufDA-Prospekte, Seiten und PLZ-Verfügbarkeit
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
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

create or replace function private.bonial_image_url_is_valid(p_url text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_url is null or p_url ~ '[[:space:][:cntrl:]#]' then false
    when p_url ~ '%([^0-9A-Fa-f]|$)|%[0-9A-Fa-f]([^0-9A-Fa-f]|$)' then false
    when p_url ~* '%0[0-9a-f]|%1[0-9a-f]|%7f' then false
    when position(chr(92) in p_url) > 0 then false
    when split_part(p_url, '?', 1) ~* '%(2f|5c|25)' then false
    when split_part(p_url, '?', 1) ~* '(^|/)(\.|%2e){1,2}(/|$)' then false
    else p_url ~ '^https://content-media\.bonial\.biz/[A-Za-z0-9._~!$&()+,;=:@%-]+(/[A-Za-z0-9._~!$&()+,;=:@%-]+)*(\?[^#[:space:]]*)?$'
  end;
$$;

create or replace function private.brochure_hotspots_are_valid(p_hotspots jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_hotspots is null or pg_catalog.jsonb_typeof(p_hotspots) is distinct from 'array'
      then false
    else not exists (
      select 1
      from pg_catalog.jsonb_array_elements(p_hotspots) as hotspot(value)
      where case
        when pg_catalog.jsonb_typeof(hotspot.value) is distinct from 'object' then true
        when pg_catalog.jsonb_typeof(hotspot.value -> 'id') is distinct from 'string' then true
        when btrim(hotspot.value ->> 'id') = '' then true
        when pg_catalog.jsonb_typeof(hotspot.value -> 'kind') is distinct from 'string' then true
        when hotspot.value ->> 'kind' not in ('discount', 'linkout', 'unknown') then true
        when pg_catalog.jsonb_typeof(hotspot.value -> 'title') is distinct from 'string' then true
        when btrim(hotspot.value ->> 'title') = '' then true
        when hotspot.value ? 'description'
          and pg_catalog.jsonb_typeof(hotspot.value -> 'description') is distinct from 'string' then true
        when hotspot.value ? 'discount'
          and pg_catalog.jsonb_typeof(hotspot.value -> 'discount') is distinct from 'string' then true
        when hotspot.value ? 'priceLabel'
          and pg_catalog.jsonb_typeof(hotspot.value -> 'priceLabel') is distinct from 'string' then true
        when hotspot.value ? 'priceCents'
          and pg_catalog.jsonb_typeof(hotspot.value -> 'priceCents') is distinct from 'number' then true
        when hotspot.value ? 'oldPriceCents'
          and pg_catalog.jsonb_typeof(hotspot.value -> 'oldPriceCents') is distinct from 'number' then true
        when pg_catalog.jsonb_typeof(hotspot.value -> 'x') is distinct from 'number' then true
        when pg_catalog.jsonb_typeof(hotspot.value -> 'y') is distinct from 'number' then true
        when pg_catalog.jsonb_typeof(hotspot.value -> 'width') is distinct from 'number' then true
        when pg_catalog.jsonb_typeof(hotspot.value -> 'height') is distinct from 'number' then true
        else
          (hotspot.value ->> 'x')::numeric < 0
          or (hotspot.value ->> 'y')::numeric < 0
          or (hotspot.value ->> 'width')::numeric <= 0
          or (hotspot.value ->> 'height')::numeric <= 0
          or (
            hotspot.value ? 'priceCents'
            and (hotspot.value ->> 'priceCents')::numeric < 0
          )
          or (
            hotspot.value ? 'oldPriceCents'
            and (hotspot.value ->> 'oldPriceCents')::numeric < 0
          )
          or (hotspot.value ->> 'x')::numeric + (hotspot.value ->> 'width')::numeric > 100
          or (hotspot.value ->> 'y')::numeric + (hotspot.value ->> 'height')::numeric > 100
          or (
            hotspot.value ? 'imageUrl'
            and not private.bonial_image_url_is_valid(hotspot.value ->> 'imageUrl')
          )
      end
    )
  end;
$$;

create or replace function private.brochure_pages_are_valid(p_pages jsonb, p_page_count integer)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_pages is null or p_page_count is null then false
    when pg_catalog.jsonb_typeof(p_pages) is distinct from 'array' then false
    when p_page_count < 1 or pg_catalog.jsonb_array_length(p_pages) <> p_page_count then false
    else not exists (
      select 1
      from pg_catalog.jsonb_array_elements(p_pages) with ordinality as page(value, position)
      where case
        when pg_catalog.jsonb_typeof(page.value) is distinct from 'object' then true
        when pg_catalog.jsonb_typeof(page.value -> 'page_number') is distinct from 'number' then true
        when page.value ->> 'page_number' <> page.position::text then true
        when not private.bonial_image_url_is_valid(page.value ->> 'image_url') then true
        when page.value ? 'thumbnail_url'
          and not private.bonial_image_url_is_valid(page.value ->> 'thumbnail_url') then true
        else not private.brochure_hotspots_are_valid(page.value -> 'hotspots')
      end
    )
  end;
$$;

create table public.brochures (
  id text primary key check (btrim(id) <> ''),
  source_content_id text not null check (btrim(source_content_id) <> ''),
  source_zip_code text not null check (source_zip_code ~ '^[0-9]{5}$'),
  store_id text not null references public.brochure_stores(id),
  title text not null check (btrim(title) <> ''),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  cover_image text not null check (private.bonial_image_url_is_valid(cover_image)),
  page_count integer not null check (page_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brochures_validity check (valid_until >= valid_from),
  constraint brochures_id_source_zip_unique unique (id, source_zip_code),
  constraint brochures_region_content_unique unique (source_zip_code, store_id, source_content_id)
);

create index brochures_store_id_idx on public.brochures (store_id);
create index brochures_valid_until_idx on public.brochures (valid_until);
create index brochures_region_idx on public.brochures (source_zip_code, store_id);

create table public.brochure_pages (
  id text primary key check (btrim(id) <> ''),
  brochure_id text not null references public.brochures(id) on delete cascade,
  page_number integer not null check (page_number > 0),
  image_url text not null check (private.bonial_image_url_is_valid(image_url)),
  thumbnail_url text check (thumbnail_url is null or private.bonial_image_url_is_valid(thumbnail_url)),
  hotspots jsonb not null default '[]'::jsonb
    check (private.brochure_hotspots_are_valid(hotspots)),
  created_at timestamptz not null default now(),
  unique (brochure_id, page_number)
);

create index brochure_pages_brochure_idx on public.brochure_pages (brochure_id, page_number);

create table public.brochure_availability (
  zip_code text not null check (zip_code ~ '^[0-9]{5}$'),
  brochure_id text not null,
  primary key (zip_code, brochure_id),
  constraint brochure_availability_regional_brochure_fk
    foreign key (brochure_id, zip_code)
    references public.brochures(id, source_zip_code) on delete cascade
);

create index brochure_availability_brochure_idx
  on public.brochure_availability (brochure_id);

create table public.brochure_zip_scans (
  zip_code text primary key check (zip_code ~ '^[0-9]{5}$'),
  requested_at timestamptz not null default now(),
  last_successful_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  updated_at timestamptz not null default now()
);

create index brochure_zip_scans_pending_idx
  on public.brochure_zip_scans (next_attempt_at, requested_at)
  where last_successful_at is null or requested_at > last_successful_at;

create or replace function private.dispatch_brochure_zip_scan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_function_url text;
  v_webhook_secret text;
begin
  if new.last_error is not null then
    return new;
  end if;

  if new.last_successful_at is not null and new.requested_at <= new.last_successful_at then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.requested_at is not distinct from old.requested_at then
    return new;
  end if;

  select decrypted_secret
  into v_function_url
  from vault.decrypted_secrets
  where name = 'brochure_dispatch_function_url'
  limit 1;

  select decrypted_secret
  into v_webhook_secret
  from vault.decrypted_secrets
  where name = 'brochure_dispatch_webhook_secret'
  limit 1;

  if coalesce(v_function_url, '') = '' or coalesce(v_webhook_secret, '') = '' then
    raise warning 'Brochure dispatch is not configured; the scheduled queue fallback remains active.';
    return new;
  end if;

  perform net.http_post(
    url := v_function_url,
    body := jsonb_build_object(
      'type', tg_op,
      'schema', 'public',
      'table', 'brochure_zip_scans',
      'record', jsonb_build_object(
        'zip_code', new.zip_code,
        'requested_at', new.requested_at,
        'last_successful_at', new.last_successful_at,
        'last_error', new.last_error
      )
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-brochure-dispatch-secret', v_webhook_secret
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

revoke all on function private.dispatch_brochure_zip_scan()
  from public, anon, authenticated, service_role;

create trigger dispatch_pending_brochure_zip_scan
  after insert or update on public.brochure_zip_scans
  for each row execute function private.dispatch_brochure_zip_scan();

alter table public.brochure_zip_scans enable row level security;

create trigger set_updated_at_brochure_zip_scans
  before update on public.brochure_zip_scans
  for each row execute function private.set_updated_at();

alter table public.brochures enable row level security;
create policy brochures_select on public.brochures
  for select to authenticated using (true);

alter table public.brochure_pages enable row level security;
create policy brochure_pages_select on public.brochure_pages
  for select to authenticated using (true);

alter table public.brochure_availability enable row level security;
create policy brochure_availability_select on public.brochure_availability
  for select to authenticated using (true);

create or replace function private.brochure_record_is_valid(p_record jsonb, p_zip_code text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when pg_catalog.jsonb_typeof(p_record) is distinct from 'object' then false
    when p_record ->> 'source_zip_code' is distinct from p_zip_code then false
    when p_record ->> 'source_content_id' is null or btrim(p_record ->> 'source_content_id') = '' then false
    when p_record ->> 'id' is distinct from
      'kaufda:' || p_zip_code || ':' || (p_record ->> 'store_id') || ':' || (p_record ->> 'source_content_id') then false
    when pg_catalog.jsonb_typeof(p_record -> 'available_zip_codes') is distinct from 'array' then false
    when pg_catalog.jsonb_array_length(p_record -> 'available_zip_codes') <> 1 then false
    when p_record -> 'available_zip_codes' ->> 0 is distinct from p_zip_code then false
    when pg_catalog.jsonb_typeof(p_record -> 'pages') is distinct from 'array' then false
    when pg_catalog.jsonb_typeof(p_record -> 'page_count') is distinct from 'number' then false
    when (p_record ->> 'page_count') !~ '^[1-9][0-9]*$' then false
    when not private.brochure_pages_are_valid(
      p_record -> 'pages', (p_record ->> 'page_count')::integer
    ) then false
    when p_record -> 'pages' -> 0 ->> 'image_url' is distinct from p_record ->> 'cover_image' then false
    when p_record ->> 'store_id' is null or btrim(p_record ->> 'store_id') = '' then false
    when p_record ->> 'store_name' is null or btrim(p_record ->> 'store_name') = '' then false
    when p_record ->> 'title' is null or btrim(p_record ->> 'title') = '' then false
    when p_record ->> 'valid_from' is null or p_record ->> 'valid_until' is null then false
    else true
  end;
$$;

create or replace function public.replace_brochure_zip(p_zip_code text, p_records jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if p_zip_code is null or p_zip_code !~ '^[0-9]{5}$' then
    raise exception 'brochure_zip_code_invalid' using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_records) is distinct from 'array' then
    raise exception 'brochure_records_must_be_an_array' using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_records) as incoming(value)
    where not private.brochure_record_is_valid(incoming.value, p_zip_code)
  ) then
    raise exception 'brochure_records_invalid_or_incomplete' using errcode = '22023';
  end if;

  if exists (
    select incoming.value ->> 'id'
    from pg_catalog.jsonb_array_elements(p_records) as incoming(value)
    group by incoming.value ->> 'id'
    having count(*) > 1
  ) then
    raise exception 'brochure_records_contain_duplicates' using errcode = '22023';
  end if;

  if exists (
    select incoming.value ->> 'store_id'
    from pg_catalog.jsonb_array_elements(p_records) as incoming(value)
    group by incoming.value ->> 'store_id'
    having count(distinct incoming.value ->> 'store_name') > 1
  ) then
    raise exception 'brochure_publisher_names_conflict' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_zip_code, 23));

  insert into public.brochure_stores (id, name, active)
  select distinct incoming.value ->> 'store_id', incoming.value ->> 'store_name', true
  from pg_catalog.jsonb_array_elements(p_records) as incoming(value)
  order by incoming.value ->> 'store_id'
  on conflict (id) do update set
    name = excluded.name,
    active = true;

  delete from public.brochure_availability
  where zip_code = p_zip_code;

  insert into public.brochures (
    id, source_content_id, source_zip_code, store_id, title, valid_from,
    valid_until, cover_image, page_count
  )
  select
    incoming.id, incoming.source_content_id, incoming.source_zip_code,
    incoming.store_id, incoming.title, incoming.valid_from, incoming.valid_until,
    incoming.cover_image, incoming.page_count
  from pg_catalog.jsonb_to_recordset(p_records) as incoming (
    id text,
    source_content_id text,
    source_zip_code text,
    store_id text,
    title text,
    valid_from timestamptz,
    valid_until timestamptz,
    cover_image text,
    page_count integer
  )
  on conflict (id) do update set
    source_content_id = excluded.source_content_id,
    source_zip_code = excluded.source_zip_code,
    store_id = excluded.store_id,
    title = excluded.title,
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until,
    cover_image = excluded.cover_image,
    page_count = excluded.page_count,
    updated_at = now();

  delete from public.brochure_pages as page
  where page.brochure_id in (
    select incoming.value ->> 'id'
    from pg_catalog.jsonb_array_elements(p_records) as incoming(value)
  );

  insert into public.brochure_pages (
    id, brochure_id, page_number, image_url, thumbnail_url, hotspots
  )
  select
    incoming.id || '_' || page.page_number::text,
    incoming.id,
    page.page_number,
    page.image_url,
    page.thumbnail_url,
    coalesce(page.hotspots, '[]'::jsonb)
  from pg_catalog.jsonb_to_recordset(p_records) as incoming (id text, pages jsonb)
  cross join lateral pg_catalog.jsonb_to_recordset(incoming.pages) as page (
    page_number integer,
    image_url text,
    thumbnail_url text,
    hotspots jsonb
  );

  insert into public.brochure_availability (zip_code, brochure_id)
  select p_zip_code, incoming.value ->> 'id'
  from pg_catalog.jsonb_array_elements(p_records) as incoming(value);

  delete from public.brochures as brochure
  where brochure.source_zip_code = p_zip_code
    and not exists (
      select 1
      from public.brochure_availability as availability
      where availability.brochure_id = brochure.id
    );

  insert into public.brochure_zip_scans (
    zip_code, requested_at, last_successful_at, next_attempt_at, attempt_count, last_error
  ) values (
    p_zip_code, now(), now(), now(), 0, null
  )
  on conflict (zip_code) do update set
    last_successful_at = now(),
    next_attempt_at = now(),
    attempt_count = 0,
    last_error = null,
    updated_at = now();
end;
$$;

create or replace function public.request_brochure_zip_scan(p_zip_code text)
returns table (
  requested_at timestamptz,
  last_successful_at timestamptz,
  next_attempt_at timestamptz,
  last_error text
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'brochure_scan_authentication_required' using errcode = '42501';
  end if;
  if p_zip_code is null or p_zip_code !~ '^[0-9]{5}$' then
    raise exception 'brochure_zip_code_invalid' using errcode = '22023';
  end if;

  insert into public.brochure_zip_scans (zip_code)
  values (p_zip_code)
  on conflict (zip_code) do update set
    requested_at = now(),
    next_attempt_at = now(),
    attempt_count = 0,
    last_error = null,
    updated_at = now()
  where (
      public.brochure_zip_scans.last_successful_at is null
      or public.brochure_zip_scans.last_successful_at < now() - interval '5 days'
    )
    and public.brochure_zip_scans.last_successful_at is not null
    and public.brochure_zip_scans.requested_at <= public.brochure_zip_scans.last_successful_at
    and public.brochure_zip_scans.next_attempt_at <= now();

  return query
  select scan.requested_at, scan.last_successful_at, scan.next_attempt_at, scan.last_error
  from public.brochure_zip_scans as scan
  where scan.zip_code = p_zip_code;
end;
$$;

create or replace function public.get_brochure_zip_scan_status(p_zip_code text)
returns table (
  requested_at timestamptz,
  last_successful_at timestamptz,
  next_attempt_at timestamptz,
  last_error text
)
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  select scan.requested_at, scan.last_successful_at, scan.next_attempt_at, scan.last_error
  from public.brochure_zip_scans as scan
  where scan.zip_code = p_zip_code
    and p_zip_code ~ '^[0-9]{5}$';
$$;

create or replace function public.get_pending_brochure_zip_scans(p_limit integer default 25)
returns table (zip_code text)
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  select scan.zip_code
  from public.brochure_zip_scans as scan
  where (scan.last_successful_at is null or scan.requested_at > scan.last_successful_at)
    and scan.next_attempt_at <= now()
  order by scan.next_attempt_at, scan.requested_at, scan.zip_code
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
$$;

create or replace function public.record_brochure_zip_scan_failure(
  p_zip_code text,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if p_zip_code is null or p_zip_code !~ '^[0-9]{5}$' then
    raise exception 'brochure_zip_code_invalid' using errcode = '22023';
  end if;

  insert into public.brochure_zip_scans (
    zip_code, next_attempt_at, attempt_count, last_error
  ) values (
    p_zip_code, now() + interval '1 hour', 1, left(coalesce(p_error, 'scan failed'), 500)
  )
  on conflict (zip_code) do update set
    next_attempt_at = now() + interval '1 hour',
    attempt_count = public.brochure_zip_scans.attempt_count + 1,
    last_error = left(coalesce(p_error, 'scan failed'), 500),
    updated_at = now();
end;
$$;

comment on table public.brochures is
  'Prospekte mit KaufDA-Inhalts-ID und PLZ-bezogener Ausgabe.';
comment on table public.brochure_pages is
  'Externe Bonial-Bild-URLs und interaktive Angebotsbereiche je Prospektseite.';
comment on table public.brochure_availability is
  'Ordnet einen regionalen Prospekt ausschließlich seiner Abruf-PLZ zu.';
comment on function public.replace_brochure_zip(text, jsonb) is
  'Ersetzt nach vollständiger Prüfung alle Prospekte für genau eine PLZ atomar.';
comment on table public.brochure_zip_scans is
  'Demand-basierte KaufDA-Aktualisierungen für PLZ, die von der App angefragt wurden.';
comment on function public.request_brochure_zip_scan(text) is
  'Stellt eine PLZ einmalig ein und erneuert sie höchstens alle fünf Tage bei App-Nutzung.';
comment on function public.get_brochure_zip_scan_status(text) is
  'Gibt den Scanstatus genau einer angefragten PLZ an die App zurück.';
comment on function public.get_pending_brochure_zip_scans(integer) is
  'Liefert dem Runner fällige, von der App angefragte PLZ-Scope.';
comment on function public.record_brochure_zip_scan_failure(text, text) is
  'Vermerkt einen fehlgeschlagenen PLZ-Scan und wartet eine Stunde bis zur Wiederholung.';
comment on function private.dispatch_brochure_zip_scan() is
  'Sendet neu angefragte PLZ asynchron an den serverseitigen Runner-Dispatch.';
