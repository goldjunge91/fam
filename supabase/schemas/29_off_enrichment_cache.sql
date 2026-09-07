-- Persistenter, globaler Cache fuer serverseitige Open-Food-Facts-Lookups.
--
-- Der Cache gehoert nicht zu einem Haushalt und ist fuer Clients nicht
-- sichtbar. Ein kurzer Lease verhindert, dass mehrere Edge-Isolates dieselbe
-- EAN gleichzeitig beim externen Provider anfragen. Nur bekannte Ergebnisse
-- (Treffer und echtes "nicht gefunden") werden gespeichert; transiente
-- Provider-/Netzwerkfehler werden beim Release wieder verworfen.

create table if not exists public.off_enrichment_cache (
  ean text primary key check (ean ~ '^[0-9]{6,14}$'),
  lookup_status text check (lookup_status is null or lookup_status in ('success', 'not_found')),
  category_tags text[] not null default '{}',
  off_last_modified_at timestamptz,
  cached_at timestamptz,
  expires_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint off_enrichment_cache_result_shape check (
    case
      when lookup_status is null then cached_at is null and expires_at is null
        and lease_token is not null and lease_expires_at is not null
      when lookup_status = 'success' then cached_at is not null and expires_at is not null
        and off_last_modified_at is not null and lease_token is null and lease_expires_at is null
      when lookup_status = 'not_found' then cached_at is not null and expires_at is not null
        and off_last_modified_at is null and category_tags = '{}'::text[]
        and lease_token is null and lease_expires_at is null
      else false
    end
  )
);

comment on table public.off_enrichment_cache is
  'Service-only OFF EAN cache with an atomic short-lived lease; transient failures are never cached.';

create index if not exists off_enrichment_cache_expiry_idx
  on public.off_enrichment_cache (coalesce(expires_at, lease_expires_at));

create or replace trigger off_enrichment_cache_set_updated_at
  before update on public.off_enrichment_cache
  for each row
  execute function private.set_updated_at();

alter table public.off_enrichment_cache enable row level security;

create policy off_enrichment_cache_service
  on public.off_enrichment_cache
  for all to service_role
  using (true)
  with check (true);

-- The Edge Function calls these RPCs with service_role. Keeping the table
-- without client policies makes accidental Data API exposure fail closed.
revoke all on public.off_enrichment_cache from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.off_enrichment_cache to service_role;

create or replace function public.claim_off_enrichment_cache(
  p_ean text,
  p_lease_seconds integer default 30
)
returns table (
  state text,
  lookup_status text,
  category_tags text[],
  off_last_modified_at timestamptz,
  lease_token uuid,
  retry_after integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cached_row public.off_enrichment_cache%rowtype;
  next_token uuid := gen_random_uuid();
begin
  if p_ean is null or p_ean !~ '^[0-9]{6,14}$' then
    raise exception using errcode = '22023', message = 'off_cache_invalid_ean';
  end if;
  if p_lease_seconds is null or p_lease_seconds < 15 or p_lease_seconds > 300 then
    raise exception using errcode = '22023', message = 'off_cache_invalid_lease';
  end if;

  -- A missing row cannot be locked with FOR UPDATE. The advisory transaction
  -- lock closes that first-request race before the row lookup/insert.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ean, 0));

  -- Expired rows are reclaimed opportunistically, so negative lookups cannot
  -- grow the table forever even when an EAN is never requested again.
  with expired_rows as (
    select cache.ean
    from public.off_enrichment_cache as cache
    where coalesce(cache.expires_at, cache.lease_expires_at)
      < statement_timestamp() - interval '7 days'
    order by coalesce(cache.expires_at, cache.lease_expires_at)
    limit 100
    for update of cache skip locked
  )
  delete from public.off_enrichment_cache as cache
  using expired_rows
  where cache.ean = expired_rows.ean;

  -- FOR UPDATE serializes claims for the same EAN across all Edge isolates.
  select *
  into cached_row
  from public.off_enrichment_cache
  where ean = p_ean
  for update;

  if cached_row.ean is not null
    and cached_row.lookup_status is not null
    and cached_row.expires_at > clock_timestamp()
  then
    return query
      select
        'hit'::text,
        cached_row.lookup_status,
        cached_row.category_tags,
        cached_row.off_last_modified_at,
        null::uuid,
        null::integer;
    return;
  end if;

  if cached_row.ean is not null
    and cached_row.lease_token is not null
    and cached_row.lease_expires_at > clock_timestamp()
  then
    return query
      select
        'in_flight'::text,
        cached_row.lookup_status,
        cached_row.category_tags,
        cached_row.off_last_modified_at,
        null::uuid,
        greatest(
          1,
          ceil(extract(epoch from (cached_row.lease_expires_at - clock_timestamp())))::integer
        );
    return;
  end if;

  if cached_row.ean is null then
    insert into public.off_enrichment_cache (ean, lease_token, lease_expires_at)
    values (p_ean, next_token, clock_timestamp() + p_lease_seconds * interval '1 second');
  else
    update public.off_enrichment_cache
    set lookup_status = null,
        category_tags = '{}',
        off_last_modified_at = null,
        cached_at = null,
        expires_at = null,
        lease_token = next_token,
        lease_expires_at = clock_timestamp() + p_lease_seconds * interval '1 second'
    where ean = p_ean;
  end if;

  return query
    select
      'claimed'::text,
      null::text,
      '{}'::text[],
      null::timestamptz,
      next_token,
      null::integer;
end;
$$;

create or replace function public.store_off_enrichment_cache(
  p_ean text,
  p_lease_token uuid,
  p_lookup_status text,
  p_category_tags text[] default '{}',
  p_off_last_modified_at timestamptz default null,
  p_ttl_seconds integer default 86400
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_lookup_status is null or p_lookup_status not in ('success', 'not_found') then
    raise exception using errcode = '22023', message = 'off_cache_invalid_status';
  end if;
  if p_ttl_seconds is null or p_ttl_seconds < 3600 or p_ttl_seconds > 604800 then
    raise exception using errcode = '22023', message = 'off_cache_invalid_ttl';
  end if;
  if p_lookup_status = 'success' and p_off_last_modified_at is null then
    raise exception using errcode = '22023', message = 'off_cache_success_requires_timestamp';
  end if;
  if p_lookup_status = 'not_found' and p_off_last_modified_at is not null then
    raise exception using errcode = '22023', message = 'off_cache_not_found_has_no_timestamp';
  end if;

  update public.off_enrichment_cache
  set lookup_status = p_lookup_status,
      category_tags = case when p_lookup_status = 'success' then coalesce(p_category_tags, '{}') else '{}'::text[] end,
      off_last_modified_at = p_off_last_modified_at,
      cached_at = clock_timestamp(),
      expires_at = clock_timestamp() + p_ttl_seconds * interval '1 second',
      lease_token = null,
      lease_expires_at = null
  where ean = p_ean
    and lease_token = p_lease_token
    and lease_expires_at > clock_timestamp();

  return found;
end;
$$;

create or replace function public.release_off_enrichment_cache(
  p_ean text,
  p_lease_token uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.off_enrichment_cache
  where ean = p_ean
    and lease_token = p_lease_token;
  return found;
end;
$$;

revoke execute on function public.claim_off_enrichment_cache(text, integer) from public, anon, authenticated;
grant execute on function public.claim_off_enrichment_cache(text, integer) to service_role;
revoke execute on function public.store_off_enrichment_cache(text, uuid, text, text[], timestamptz, integer) from public, anon, authenticated;
grant execute on function public.store_off_enrichment_cache(text, uuid, text, text[], timestamptz, integer) to service_role;
revoke execute on function public.release_off_enrichment_cache(text, uuid) from public, anon, authenticated;
grant execute on function public.release_off_enrichment_cache(text, uuid) to service_role;
