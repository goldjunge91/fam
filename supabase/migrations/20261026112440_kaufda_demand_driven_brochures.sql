SET local check_function_bodies = off;

DROP INDEX "public"."brochure_availability_canonical_brochure_id_idx";

ALTER TABLE "public"."brochure_availability"
  DROP CONSTRAINT "brochure_availability_pkey";

ALTER TABLE "public"."brochure_availability"
  DROP CONSTRAINT "brochure_availability_regional_brochure_fk";

ALTER TABLE "public"."brochure_stores"
  DROP CONSTRAINT "brochure_stores_logo_url_check";

ALTER TABLE "public"."canonical_brochures"
  DROP CONSTRAINT "canonical_brochures_store_id_fkey";

DROP FUNCTION "public"."replace_canonical_brochure_catalog"(jsonb, text[]);

ALTER TABLE "public"."brochure_availability"
  DROP COLUMN "canonical_brochure_id";

DROP TABLE "public"."canonical_brochures";

DROP FUNCTION "private"."bring_image_url_is_valid"(text);

DROP FUNCTION "private"."canonical_brochure_pages_are_valid"(jsonb, integer);

CREATE TABLE "public"."brochure_pages" (
  "id"            text                     NOT NULL,
  "brochure_id"   text                     NOT NULL,
  "page_number"   integer                  NOT NULL,
  "image_url"     text                     NOT NULL,
  "thumbnail_url" text,
  "hotspots"      jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "brochure_pages_brochure_id_page_number_key" UNIQUE (brochure_id, page_number),
  CONSTRAINT "brochure_pages_id_check" CHECK ((btrim(id) <> ''::text)),
  CONSTRAINT "brochure_pages_page_number_check" CHECK ((page_number > 0)),
  CONSTRAINT "brochure_pages_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."brochure_pages"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."brochure_pages" FROM "anon";

CREATE TABLE "public"."brochure_zip_scans" (
  "zip_code"           text                     NOT NULL,
  "requested_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "last_successful_at" timestamp with time zone,
  "next_attempt_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "attempt_count"      integer                  NOT NULL DEFAULT 0,
  "last_error"         text,
  "updated_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "brochure_zip_scans_attempt_count_check" CHECK ((attempt_count >= 0)),
  CONSTRAINT "brochure_zip_scans_pkey" PRIMARY KEY (zip_code),
  CONSTRAINT "brochure_zip_scans_zip_code_check" CHECK ((zip_code ~ '^[0-9]{5}$'::text))
);

ALTER TABLE "public"."brochure_zip_scans"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."brochure_zip_scans" FROM "anon", "authenticated";

CREATE TABLE "public"."brochures" (
  "id"                text                     NOT NULL,
  "source_content_id" text                     NOT NULL,
  "source_zip_code"   text                     NOT NULL,
  "store_id"          text                     NOT NULL,
  "title"             text                     NOT NULL,
  "valid_from"        timestamp with time zone NOT NULL,
  "valid_until"       timestamp with time zone NOT NULL,
  "cover_image"       text                     NOT NULL,
  "page_count"        integer                  NOT NULL,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "brochures_id_check" CHECK ((btrim(id) <> ''::text)),
  CONSTRAINT "brochures_id_source_zip_unique" UNIQUE (id, source_zip_code),
  CONSTRAINT "brochures_page_count_check" CHECK ((page_count > 0)),
  CONSTRAINT "brochures_pkey" PRIMARY KEY (id),
  CONSTRAINT "brochures_region_content_unique" UNIQUE (source_zip_code, store_id, source_content_id),
  CONSTRAINT "brochures_source_content_id_check" CHECK ((btrim(source_content_id) <> ''::text)),
  CONSTRAINT "brochures_source_zip_code_check" CHECK ((source_zip_code ~ '^[0-9]{5}$'::text)),
  CONSTRAINT "brochures_title_check" CHECK ((btrim(title) <> ''::text)),
  CONSTRAINT "brochures_validity" CHECK ((valid_until >= valid_from))
);

ALTER TABLE "public"."brochures"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."brochures" FROM "anon";

ALTER TABLE "public"."brochure_availability"
  ADD COLUMN "brochure_id" text NOT NULL;

CREATE OR REPLACE FUNCTION private.bonial_image_url_is_valid (
  p_url text
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO 'pg_catalog'
  AS $function$
  select case
    when p_url is null or p_url ~ '[[:space:][:cntrl:]#]' then false
    when p_url ~ '%([^0-9A-Fa-f]|$)|%[0-9A-Fa-f]([^0-9A-Fa-f]|$)' then false
    when p_url ~* '%0[0-9a-f]|%1[0-9a-f]|%7f' then false
    when position(chr(92) in p_url) > 0 then false
    when split_part(p_url, '?', 1) ~* '%(2f|5c|25)' then false
    when split_part(p_url, '?', 1) ~* '(^|/)(\.|%2e){1,2}(/|$)' then false
    else p_url ~ '^https://content-media\.bonial\.biz/[A-Za-z0-9._~!$&()+,;=:@%-]+(/[A-Za-z0-9._~!$&()+,;=:@%-]+)*(\?[^#[:space:]]*)?$'
  end;
$function$;

CREATE OR REPLACE FUNCTION private.brochure_hotspots_are_valid (
  p_hotspots jsonb
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO 'pg_catalog'
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION private.brochure_pages_are_valid (
  p_pages      jsonb,
  p_page_count integer
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO 'pg_catalog'
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION private.brochure_record_is_valid (
  p_record   jsonb,
  p_zip_code text
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO 'pg_catalog'
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_brochure_zip_scan_status (
  p_zip_code text
)
  RETURNS TABLE (
    requested_at       timestamp with time zone,
    last_successful_at timestamp with time zone,
    next_attempt_at    timestamp with time zone,
    last_error         text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'pg_temp'
  AS $function$
  select scan.requested_at, scan.last_successful_at, scan.next_attempt_at, scan.last_error
  from public.brochure_zip_scans as scan
  where scan.zip_code = p_zip_code
    and p_zip_code ~ '^[0-9]{5}$';
$function$;

REVOKE ALL ON FUNCTION "public"."get_brochure_zip_scan_status"(text) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.get_pending_brochure_zip_scans (
  p_limit integer DEFAULT 25
)
  RETURNS TABLE (
    zip_code text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'pg_temp'
  AS $function$
  select scan.zip_code
  from public.brochure_zip_scans as scan
  where (scan.last_successful_at is null or scan.requested_at > scan.last_successful_at)
    and scan.next_attempt_at <= now()
  order by scan.next_attempt_at, scan.requested_at, scan.zip_code
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
$function$;

REVOKE ALL ON FUNCTION "public"."get_pending_brochure_zip_scans"(integer) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.record_brochure_zip_scan_failure (
  p_zip_code text,
  p_error    text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'pg_temp'
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."record_brochure_zip_scan_failure"(text, text) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.replace_brochure_zip (
  p_zip_code text,
  p_records  jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'pg_temp'
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."replace_brochure_zip"(text, jsonb) FROM PUBLIC, "anon", "authenticated";

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
$function$;

REVOKE ALL ON FUNCTION "public"."request_brochure_zip_scan"(text) FROM PUBLIC, "anon", "service_role";

ALTER TABLE "public"."brochure_availability"
  ADD CONSTRAINT "brochure_availability_pkey" PRIMARY KEY (zip_code, brochure_id);

ALTER TABLE "public"."brochure_availability"
  ADD CONSTRAINT "brochure_availability_regional_brochure_fk" FOREIGN KEY (brochure_id, zip_code) REFERENCES public.brochures(id, source_zip_code) ON DELETE CASCADE;

ALTER TABLE "public"."brochure_pages"
  ADD CONSTRAINT "brochure_pages_brochure_id_fkey" FOREIGN KEY (brochure_id) REFERENCES public.brochures(id) ON DELETE CASCADE;

ALTER TABLE "public"."brochures"
  ADD CONSTRAINT "brochures_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.brochure_stores(id);

CREATE INDEX brochure_availability_brochure_idx ON public.brochure_availability USING btree (brochure_id);

CREATE INDEX brochure_pages_brochure_idx ON public.brochure_pages USING btree (brochure_id, page_number);

CREATE INDEX brochure_zip_scans_pending_idx ON public.brochure_zip_scans USING btree (next_attempt_at, requested_at)
  WHERE ((last_successful_at IS NULL) OR (requested_at > last_successful_at));

CREATE INDEX brochures_region_idx ON public.brochures USING btree (source_zip_code, store_id);

CREATE INDEX brochures_store_id_idx ON public.brochures USING btree (store_id);

CREATE INDEX brochures_valid_until_idx ON public.brochures USING btree (valid_until);

CREATE TRIGGER set_updated_at_brochure_zip_scans
  BEFORE UPDATE ON public.brochure_zip_scans
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY "brochure_pages_select" ON "public"."brochure_pages"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "brochures_select" ON "public"."brochures"
  FOR SELECT
  TO "authenticated"
  USING (true);

COMMENT ON FUNCTION "public"."get_brochure_zip_scan_status"(text) IS 'Gibt den Scanstatus genau einer angefragten PLZ an die App zurück.';

COMMENT ON FUNCTION "public"."get_pending_brochure_zip_scans"(integer) IS 'Liefert dem Runner fällige, von der App angefragte PLZ-Scope.';

COMMENT ON FUNCTION "public"."record_brochure_zip_scan_failure"(text, text) IS 'Vermerkt einen fehlgeschlagenen PLZ-Scan und wartet eine Stunde bis zur Wiederholung.';

COMMENT ON FUNCTION "public"."replace_brochure_zip"(text, jsonb) IS 'Ersetzt nach vollständiger Prüfung alle Prospekte für genau eine PLZ atomar.';

COMMENT ON FUNCTION "public"."request_brochure_zip_scan"(text) IS 'Stellt eine PLZ einmalig ein und erneuert sie höchstens alle fünf Tage bei App-Nutzung.';

COMMENT ON TABLE "public"."brochure_availability" IS 'Ordnet einen regionalen Prospekt ausschließlich seiner Abruf-PLZ zu.';

COMMENT ON TABLE "public"."brochure_pages" IS 'Externe Bonial-Bild-URLs und interaktive Angebotsbereiche je Prospektseite.';

COMMENT ON TABLE "public"."brochure_zip_scans" IS 'Demand-basierte KaufDA-Aktualisierungen für PLZ, die von der App angefragt wurden.';

COMMENT ON TABLE "public"."brochures" IS 'Prospekte mit KaufDA-Inhalts-ID und PLZ-bezogener Ausgabe.';

REVOKE ALL ON FUNCTION "private"."bonial_image_url_is_valid"(text) FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."brochure_hotspots_are_valid"(jsonb) FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."brochure_pages_are_valid"(jsonb, integer) FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."brochure_record_is_valid"(jsonb, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_brochure_zip_scan_status"(text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_brochure_zip_scan_status"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_brochure_zip_scan_status"(text) TO "postgres";

REVOKE ALL ON FUNCTION "public"."get_pending_brochure_zip_scans"(integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_pending_brochure_zip_scans"(integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_pending_brochure_zip_scans"(integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."record_brochure_zip_scan_failure"(text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."record_brochure_zip_scan_failure"(text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."record_brochure_zip_scan_failure"(text, text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."replace_brochure_zip"(text, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."replace_brochure_zip"(text, jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."replace_brochure_zip"(text, jsonb) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."request_brochure_zip_scan"(text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."request_brochure_zip_scan"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."request_brochure_zip_scan"(text) TO "postgres";

REVOKE ALL ON TABLE "public"."brochure_pages" FROM "authenticated";

GRANT SELECT ON TABLE "public"."brochure_pages" TO "authenticated";

REVOKE ALL ON TABLE "public"."brochure_pages" FROM "service_role";

GRANT SELECT ON TABLE "public"."brochure_pages" TO "service_role";

REVOKE ALL ON TABLE "public"."brochure_zip_scans" FROM "service_role";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."brochure_zip_scans" TO "service_role";

REVOKE ALL ON TABLE "public"."brochures" FROM "authenticated";

GRANT SELECT ON TABLE "public"."brochures" TO "authenticated";

REVOKE ALL ON TABLE "public"."brochures" FROM "service_role";

GRANT SELECT ON TABLE "public"."brochures" TO "service_role";

ALTER TABLE "public"."brochure_pages"
  ADD CONSTRAINT "brochure_pages_hotspots_check" CHECK (private.brochure_hotspots_are_valid(hotspots));

ALTER TABLE "public"."brochure_pages"
  ADD CONSTRAINT "brochure_pages_image_url_check" CHECK (private.bonial_image_url_is_valid(image_url));

ALTER TABLE "public"."brochure_pages"
  ADD CONSTRAINT "brochure_pages_thumbnail_url_check" CHECK (((thumbnail_url IS NULL) OR private.bonial_image_url_is_valid(thumbnail_url)));

ALTER TABLE "public"."brochures"
  ADD CONSTRAINT "brochures_cover_image_check" CHECK (private.bonial_image_url_is_valid(cover_image));
