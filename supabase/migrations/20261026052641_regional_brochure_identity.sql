SET local check_function_bodies = off;

ALTER TABLE "public"."brochure_availability"
  DROP CONSTRAINT "brochure_availability_canonical_brochure_id_fkey";

ALTER TABLE "public"."canonical_brochures"
  DROP CONSTRAINT "canonical_brochures_canonical_brn_key";

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
      when pg_catalog.jsonb_array_length(input_row.value -> 'available_zip_codes') = 0
        then true
      else exists (
        select 1
        from pg_catalog.jsonb_array_elements(input_row.value -> 'available_zip_codes')
          as availability(value)
        where pg_catalog.jsonb_typeof(availability.value) is distinct from 'string'
          or coalesce(availability.value #>> '{}', '') !~ '^[0-9]{5}$'
          or not (coalesce(availability.value #>> '{}', '') = any(p_scoped_zip_codes))
      )
    end
  ) then
    raise exception 'catalog_record_availability_outside_scope' using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_records) as input_row(value)
    where pg_catalog.jsonb_array_length(input_row.value -> 'available_zip_codes') <>
      (
        select count(distinct availability.value #>> '{}')::integer
        from pg_catalog.jsonb_array_elements(input_row.value -> 'available_zip_codes')
          as availability(value)
      )
  ) then
    raise exception 'catalog_record_availability_contains_duplicates' using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(p_records) as incoming (id text, canonical_brn text, source_zip_code text)
    where incoming.canonical_brn is null
      or pg_catalog.btrim(incoming.canonical_brn) = ''
      or incoming.source_zip_code is null
      or incoming.source_zip_code !~ '^[0-9]{5}$'
      or incoming.id is distinct from 'canonical:' || incoming.source_zip_code || ':' || incoming.canonical_brn
  ) then
    raise exception 'catalog_record_id_must_match_regional_brochure' using errcode = '22023';
  end if;

  if exists (
    select incoming.source_zip_code, incoming.canonical_brn
    from pg_catalog.jsonb_to_recordset(p_records) as incoming (source_zip_code text, canonical_brn text)
    group by incoming.source_zip_code, incoming.canonical_brn
    having count(*) > 1
  ) then
    raise exception 'catalog_records_contain_duplicate_regional_brochures' using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(p_records) as incoming (source_zip_code text, available_zip_codes jsonb)
    where incoming.source_zip_code is null
      or incoming.source_zip_code !~ '^[0-9]{5}$'
      or not (incoming.source_zip_code = any(p_scoped_zip_codes))
      or pg_catalog.jsonb_array_length(incoming.available_zip_codes) <> 1
      or not exists (
        select 1
        from pg_catalog.jsonb_array_elements_text(incoming.available_zip_codes) as availability(zip_code)
        where availability.zip_code = incoming.source_zip_code
      )
  ) then
    raise exception 'catalog_record_availability_must_match_source_zip_code' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(823491, 23);

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
  select availability.zip_code, incoming.id
  from pg_catalog.jsonb_to_recordset(p_records) as incoming (
    id text,
    available_zip_codes jsonb
  )
  cross join lateral pg_catalog.jsonb_array_elements_text(incoming.available_zip_codes)
    as availability(zip_code);

  delete from public.canonical_brochures as brochure
  where not exists (
    select 1
    from public.brochure_availability as availability
    where availability.canonical_brochure_id = brochure.id
  );
end;
$function$;

ALTER TABLE "public"."canonical_brochures"
  ADD CONSTRAINT "canonical_brochures_id_source_zip_unique" UNIQUE (id, source_zip_code);

ALTER TABLE "public"."brochure_availability"
  ADD CONSTRAINT "brochure_availability_regional_brochure_fk" FOREIGN KEY (canonical_brochure_id, zip_code) REFERENCES public.canonical_brochures(id, source_zip_code)
    ON DELETE CASCADE;

ALTER TABLE "public"."canonical_brochures"
  ADD CONSTRAINT "canonical_brochures_source_zip_brn_unique" UNIQUE (source_zip_code, canonical_brn);

COMMENT ON COLUMN "public"."canonical_brochures"."source_zip_code" IS 'PLZ, für die die Detailmetadaten dieser BRN abgerufen wurden.';

COMMENT ON FUNCTION "public"."replace_canonical_brochure_catalog"(jsonb, text[]) IS 'Ersetzt regionale PLZ/BRN-Metadaten atomar für den Crawl-Scope.';

COMMENT ON TABLE "public"."brochure_availability" IS 'Verknüpft einen Prospekt nur mit der PLZ, für die seine Detailmetadaten abgerufen wurden.';

COMMENT ON TABLE "public"."canonical_brochures" IS 'Ein Datensatz pro PLZ und Bring-BRN mit vollständigen Seiten, Hotspots und originalen Bring-Quell-URLs.';
