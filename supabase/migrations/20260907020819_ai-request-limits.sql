SET local check_function_bodies = off;

CREATE TABLE "private"."request_limits" (
  "user_id"           uuid                     NOT NULL,
  "scope"             text                     NOT NULL,
  "window_started_at" timestamp with time zone NOT NULL,
  "requests"          integer                  NOT NULL,
  CONSTRAINT "request_limits_pkey" PRIMARY KEY (user_id, scope),
  CONSTRAINT "request_limits_requests_check" CHECK ((requests > 0)),
  CONSTRAINT "request_limits_scope_check" CHECK ((scope = ANY (ARRAY['ai-gateway'::text, 'off-enrichment'::text])))
);

ALTER TABLE "private"."request_limits"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."off_enrichment_cache" (
  "ean"                  text                     NOT NULL,
  "lookup_status"        text,
  "category_tags"        text[]                   NOT NULL DEFAULT '{}'::text[],
  "off_last_modified_at" timestamp with time zone,
  "cached_at"            timestamp with time zone,
  "expires_at"           timestamp with time zone,
  "lease_token"          uuid,
  "lease_expires_at"     timestamp with time zone,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "off_enrichment_cache_ean_check" CHECK ((ean ~ '^[0-9]{6,14}$'::text)),
  CONSTRAINT "off_enrichment_cache_lookup_status_check" CHECK (((lookup_status IS NULL) OR (lookup_status = ANY (ARRAY['success'::text, 'not_found'::text])))),
  CONSTRAINT "off_enrichment_cache_pkey" PRIMARY KEY (ean),
  CONSTRAINT "off_enrichment_cache_result_shape" CHECK (
CASE
    WHEN (lookup_status IS NULL) THEN ((cached_at IS NULL) AND (expires_at IS NULL) AND (lease_token IS NOT NULL) AND (lease_expires_at IS NOT NULL))
    WHEN (lookup_status = 'success'::text) THEN ((cached_at IS NOT NULL) AND (expires_at IS NOT NULL) AND (off_last_modified_at IS
      NOT NULL) AND (lease_token IS NULL) AND (lease_expires_at IS NULL))
    WHEN (lookup_status = 'not_found'::text) THEN ((cached_at IS NOT NULL) AND (expires_at IS
      NOT NULL) AND (off_last_modified_at IS NULL) AND (category_tags = '{}'::text[]) AND (lease_token IS NULL) AND (lease_expires_at IS NULL))
    ELSE false
END)
);

ALTER TABLE "public"."off_enrichment_cache"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.book_ai_credit (
  p_household_id  uuid,
  p_action        text,
  p_request_id    uuid,
  p_monthly_limit integer DEFAULT 100
)
  RETURNS TABLE (
    credits_used      integer,
    credits_remaining integer,
    credit_limit      integer,
    warning_reached   boolean,
    blocked           boolean
  )
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_subscriber_user_id uuid;
  v_weight smallint;
  v_existing smallint;
  v_usage integer;
  v_ai_active boolean;
  v_ai_expires_at timestamptz;
begin
  if p_monthly_limit is null or p_monthly_limit < 1 or p_request_id is null then
    raise exception using errcode = '22023', message = 'ai_credit_invalid_request';
  end if;

  select a.subscriber_user_id into v_subscriber_user_id
  from public.revenuecat_ai_assignments as a
  where a.household_id = p_household_id and a.active
  for update;
  if v_subscriber_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'ai_household_not_assigned';
  end if;

  -- Lock the projection as well as the assignment. This keeps the
  -- entitlement check consistent with a concurrent webhook/deactivation.
  select h.ai_active, h.ai_expires_at
  into v_ai_active, v_ai_expires_at
  from public.households as h
  where h.id = p_household_id
    and h.ai_subscriber_id = v_subscriber_user_id
  for update;
  if not coalesce(v_ai_active, false)
    or (v_ai_expires_at is not null and v_ai_expires_at <= clock_timestamp())
  then
    raise exception using errcode = '42501', message = 'ai_entitlement_required';
  end if;

  v_weight := case p_action
    when 'suggestion' then 1
    when 'recipe' then 3
    when 'voice' then 2
    else null
  end;
  if v_weight is null then
    raise exception using errcode = '22023', message = 'ai_credit_invalid_action';
  end if;

  select b.credits into v_existing
  from public.ai_credit_bookings as b
  where b.subscriber_user_id = v_subscriber_user_id and b.request_id = p_request_id;

  if v_existing is not null and v_existing <> v_weight then
    raise exception using errcode = '22023', message = 'ai_credit_request_conflict';
  end if;

  if v_existing is null then
    v_usage := private.ai_credit_month_usage(v_subscriber_user_id);
    if v_usage + v_weight > p_monthly_limit then
      raise exception using errcode = 'P0001', message = 'ai_credit_limit_exceeded';
    end if;

    insert into public.ai_credit_bookings (subscriber_user_id, request_id, action, credits)
    values (v_subscriber_user_id, p_request_id, p_action, v_weight);

    v_usage := v_usage + v_weight;
  else
    v_usage := private.ai_credit_month_usage(v_subscriber_user_id);
  end if;

  return query select
    v_usage,
    greatest(p_monthly_limit - v_usage, 0),
    p_monthly_limit,
    v_usage >= ceil(p_monthly_limit * 0.8),
    v_usage >= p_monthly_limit;
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_off_enrichment_cache (
  p_ean           text,
  p_lease_seconds integer DEFAULT 30
)
  RETURNS TABLE (
    state                text,
    lookup_status        text,
    category_tags        text[],
    off_last_modified_at timestamp with time zone,
    lease_token          uuid,
    retry_after          integer
  )
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.consume_request_limit (
  p_user_id        uuid,
  p_scope          text,
  p_limit          integer,
  p_window_seconds integer
)
  RETURNS TABLE (
    allowed     boolean,
    retry_after integer
  )
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_counter private.request_limits%rowtype;
  v_now timestamptz;
begin
  if p_user_id is null or p_scope is null
    or p_scope not in ('ai-gateway', 'off-enrichment')
    or p_limit is null or p_limit < 1 or p_limit > 10000
    or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception using errcode = '22023', message = 'invalid_rate_limit';
  end if;

  insert into private.request_limits (user_id, scope, window_started_at, requests)
  values (p_user_id, p_scope, clock_timestamp(), 1)
  on conflict (user_id, scope) do nothing;
  if found then
    return query select true, 0;
    return;
  end if;

  select * into v_counter from private.request_limits
  where user_id = p_user_id and scope = p_scope for update;
  v_now := clock_timestamp();

  if v_counter.window_started_at + make_interval(secs => p_window_seconds) <= v_now then
    update private.request_limits set window_started_at = v_now, requests = 1
    where user_id = p_user_id and scope = p_scope;
    return query select true, 0;
  elsif v_counter.requests < p_limit then
    update private.request_limits set requests = requests + 1
    where user_id = p_user_id and scope = p_scope;
    return query select true, 0;
  else
    return query select false, greatest(1, ceil(extract(epoch from
      v_counter.window_started_at + make_interval(secs => p_window_seconds) - v_now))::integer);
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.release_ai_credit (
  p_request_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_subscriber_user_id uuid;
begin
  if p_request_id is null then
    return;
  end if;

  -- Serialize a refund with a concurrent booking for the same subscriber.
  -- The booking row is read first because the public contract only carries
  -- the server-generated request ID.
  select subscriber_user_id
  into v_subscriber_user_id
  from public.ai_credit_bookings
  where request_id = p_request_id
  for update;

  if v_subscriber_user_id is null then
    return;
  end if;

  perform 1
  from public.revenuecat_ai_assignments
  where subscriber_user_id = v_subscriber_user_id
  for update;

  delete from public.ai_credit_bookings
  where subscriber_user_id = v_subscriber_user_id
    and request_id = p_request_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.release_off_enrichment_cache (
  p_ean         text,
  p_lease_token uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  delete from public.off_enrichment_cache
  where ean = p_ean
    and lease_token = p_lease_token;
  return found;
end;
$function$;

CREATE OR REPLACE FUNCTION public.store_off_enrichment_cache (
  p_ean                  text,
  p_lease_token          uuid,
  p_lookup_status        text,
  p_category_tags        text[]                   DEFAULT '{}'::text[],
  p_off_last_modified_at timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_ttl_seconds          integer                  DEFAULT 86400
)
  RETURNS boolean
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

ALTER TABLE "private"."request_limits"
  ADD CONSTRAINT "request_limits_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX off_enrichment_cache_expiry_idx ON public.off_enrichment_cache USING btree (COALESCE(expires_at, lease_expires_at));

CREATE TRIGGER off_enrichment_cache_set_updated_at
  BEFORE UPDATE ON public.off_enrichment_cache
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY "request_limits_service" ON "private"."request_limits"
  FOR ALL
  TO "service_role"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "off_enrichment_cache_service" ON "public"."off_enrichment_cache"
  FOR ALL
  TO "service_role"
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE "public"."off_enrichment_cache" IS 'Service-only OFF EAN cache with an atomic short-lived lease; transient failures are never cached.';

REVOKE ALL ON FUNCTION "public"."claim_off_enrichment_cache"(text, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."claim_off_enrichment_cache"(text, integer) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."consume_request_limit"(uuid, text, integer, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."consume_request_limit"(uuid, text, integer, integer) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."release_ai_credit"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."release_ai_credit"(uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."release_off_enrichment_cache"(text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."release_off_enrichment_cache"(text, uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."store_off_enrichment_cache"(text, uuid, text, text[], timestamp WITH time zone, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."store_off_enrichment_cache"(text, uuid, text, text[], timestamp WITH time zone, integer) TO "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."request_limits" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "private"."request_limits" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."off_enrichment_cache" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."off_enrichment_cache" TO "service_role";
