SET local check_function_bodies = off;

ALTER TABLE "public"."canonical_brochures"
  DROP CONSTRAINT "canonical_brochures_cover_image_check";

ALTER TABLE "public"."canonical_brochures"
  DROP CONSTRAINT "canonical_brochures_verified_sha256_check";

ALTER TABLE "public"."canonical_brochures"
  DROP COLUMN "verified_sha256";

ALTER TABLE "public"."canonical_brochures"
  ADD COLUMN "source_zip_code" text NOT NULL;

CREATE OR REPLACE FUNCTION private.bring_image_url_is_valid (
  p_url text
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO 'pg_catalog'
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION private.canonical_brochure_pages_are_valid (
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
$function$;

CREATE OR REPLACE FUNCTION public.replace_canonical_brochure_catalog (
  p_records          jsonb,
  p_scoped_zip_codes text[]
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'pg_temp'
  AS $function$
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
$function$;

ALTER TABLE "public"."canonical_brochures"
  ADD CONSTRAINT "canonical_brochures_source_zip_code_check" CHECK ((source_zip_code ~ '^[0-9]{5}$'::text));

CREATE INDEX canonical_brochures_region_idx ON public.canonical_brochures USING btree (source_zip_code, canonical_brn);

COMMENT ON COLUMN "public"."canonical_brochures"."source_zip_code" IS 'PLZ des Detailabrufs für die konkrete regionale Ausgabe.';

COMMENT ON FUNCTION "public"."replace_canonical_brochure_catalog"(jsonb, text[]) IS 'Ersetzt regionale Prospektmetadaten und belegte PLZ atomar für den vollständigen Crawl-Scope.';

COMMENT ON TABLE "public"."brochure_availability" IS 'Verknüpft eine konkrete regionale Ausgabe ausschließlich mit belegten PLZ.';

COMMENT ON TABLE "public"."canonical_brochures" IS 'Regionaler Prospektkatalog mit vollständigen Seiten, Hotspots und originalen Bring-Quell-URLs.';

ALTER TABLE "public"."brochure_stores"
  ADD CONSTRAINT "brochure_stores_logo_url_check" CHECK (((logo_url IS NULL) OR private.bring_image_url_is_valid(logo_url)));

ALTER TABLE "public"."canonical_brochures"
  ADD CONSTRAINT "canonical_brochures_cover_image_check" CHECK (private.bring_image_url_is_valid(cover_image));
