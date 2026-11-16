SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.request_brochure_zip_scan (
  p_zip_code text
)
  RETURNS TABLE (
    requested_at       timestamp with time zone,
    last_successful_at timestamp with time zone,
    next_attempt_at    timestamp with time zone,
    last_error         text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'pg_temp'
  AS $function$
declare
  v_user_id uuid;
  v_scan public.brochure_zip_scans%rowtype;
  v_needs_enqueue boolean;
  v_requested_at timestamptz;
  v_global_scan_count bigint;
  v_user_scan_count bigint;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'brochure_scan_authentication_required' using errcode = '42501';
  end if;
  if p_zip_code is null or p_zip_code !~ '^[0-9]{5}$' then
    raise exception 'brochure_zip_code_invalid' using errcode = '22023';
  end if;
  if not (p_zip_code = any (private.brochure_supported_zip_codes())) then
    raise exception 'brochure_zip_code_unsupported' using errcode = '22023';
  end if;

  select scan.*
  into v_scan
  from public.brochure_zip_scans as scan
  where scan.zip_code = p_zip_code;

  if found then
    v_needs_enqueue := (
      v_scan.last_error is null
      and v_scan.last_successful_at is not null
      and v_scan.requested_at <= v_scan.last_successful_at
      and v_scan.next_attempt_at <= pg_catalog.clock_timestamp()
      and (
        v_scan.last_successful_at < pg_catalog.clock_timestamp() - interval '5 days'
        or (
          v_scan.last_successful_at < pg_catalog.clock_timestamp() - interval '1 day'
          and (
            not exists (
              select 1
              from public.brochures as brochure
              where brochure.source_zip_code = p_zip_code
            )
            or exists (
              select 1
              from public.brochures as brochure
              where brochure.source_zip_code = p_zip_code
              group by brochure.store_id
              having max(brochure.valid_until) < pg_catalog.clock_timestamp()
            )
          )
        )
      )
    ) or (
      v_scan.last_error is not null
      and v_scan.attempt_count >= 4
      and v_scan.next_attempt_at <= pg_catalog.clock_timestamp()
    );
    if not v_needs_enqueue then
      return query
      select v_scan.requested_at, v_scan.last_successful_at,
        v_scan.next_attempt_at, v_scan.last_error;
      return;
    end if;
  end if;

  -- Serialize new scan admissions so distinct PLZ cannot pass the global cap together.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('brochure_scan_enqueue_budget', 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_zip_code, 23)
  );

  select scan.*
  into v_scan
  from public.brochure_zip_scans as scan
  where scan.zip_code = p_zip_code
  for update;

  if found then
    v_needs_enqueue := (
      v_scan.last_error is null
      and v_scan.last_successful_at is not null
      and v_scan.requested_at <= v_scan.last_successful_at
      and v_scan.next_attempt_at <= pg_catalog.clock_timestamp()
      and (
        v_scan.last_successful_at < pg_catalog.clock_timestamp() - interval '5 days'
        or (
          v_scan.last_successful_at < pg_catalog.clock_timestamp() - interval '1 day'
          and (
            not exists (
              select 1
              from public.brochures as brochure
              where brochure.source_zip_code = p_zip_code
            )
            or exists (
              select 1
              from public.brochures as brochure
              where brochure.source_zip_code = p_zip_code
              group by brochure.store_id
              having max(brochure.valid_until) < pg_catalog.clock_timestamp()
            )
          )
        )
      )
    ) or (
      v_scan.last_error is not null
      and v_scan.attempt_count >= 4
      and v_scan.next_attempt_at <= pg_catalog.clock_timestamp()
    );
    if not v_needs_enqueue then
      return query
      select v_scan.requested_at, v_scan.last_successful_at,
        v_scan.next_attempt_at, v_scan.last_error;
      return;
    end if;
  end if;

  v_requested_at := pg_catalog.clock_timestamp();

  -- Keep a true rolling window while bounding stored events to recent admissions.
  delete from private.brochure_scan_budget_events as event
  where event.created_at <= v_requested_at - interval '24 hours';

  select count(*)
  into v_global_scan_count
  from private.brochure_scan_budget_events as event
  where event.created_at > v_requested_at - interval '24 hours';

  select count(*)
  into v_user_scan_count
  from private.brochure_scan_budget_events as event
  where event.user_id = v_user_id
    and event.created_at > v_requested_at - interval '24 hours';

  -- A household can request three distinct postal codes per day; globally, cap
  -- newly queued scans at 25 per rolling day.
  if v_user_scan_count >= 3 then
    raise exception 'brochure_scan_account_budget_exceeded' using errcode = 'P0001';
  end if;
  if v_global_scan_count >= 25 then
    raise exception 'brochure_scan_global_budget_exceeded' using errcode = 'P0001';
  end if;

  insert into private.brochure_scan_budget_events (user_id, created_at)
  values (v_user_id, v_requested_at);

  insert into public.brochure_zip_scans (zip_code)
  values (p_zip_code)
  on conflict (zip_code) do update set
    requested_at = v_requested_at,
    next_attempt_at = v_requested_at,
    attempt_count = 0,
    last_error = null,
    updated_at = v_requested_at;

  return query
  select scan.requested_at, scan.last_successful_at, scan.next_attempt_at, scan.last_error
  from public.brochure_zip_scans as scan
  where scan.zip_code = p_zip_code;
end;
$function$;
