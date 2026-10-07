SET local check_function_bodies = off;

REVOKE ALL ON TABLE "public"."brochure_stores" FROM "anon";

DROP TABLE "public"."brochure_dumps";

CREATE TABLE "public"."brochure_availability" (
  "zip_code"              text NOT NULL,
  "canonical_brochure_id" text NOT NULL,
  CONSTRAINT "brochure_availability_pkey" PRIMARY KEY (zip_code, canonical_brochure_id),
  CONSTRAINT "brochure_availability_zip_code_check" CHECK ((zip_code ~ '^[0-9]{5}$'::text))
);

ALTER TABLE "public"."brochure_availability"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."brochure_availability" FROM "anon", "service_role";

CREATE TABLE "public"."canonical_brochures" (
  "id"              text                     NOT NULL,
  "canonical_brn"   text                     NOT NULL,
  "store_id"        text                     NOT NULL,
  "title"           text                     NOT NULL,
  "valid_from"      timestamp with time zone NOT NULL,
  "valid_until"     timestamp with time zone NOT NULL,
  "page_count"      integer                  NOT NULL,
  "cover_image"     text                     NOT NULL,
  "pages"           jsonb                    NOT NULL,
  "verified_sha256" text                     NOT NULL,
  CONSTRAINT "canonical_brochures_canonical_brn_check" CHECK ((btrim(canonical_brn) <> ''::text)),
  CONSTRAINT "canonical_brochures_cover_image_check" CHECK ((cover_image ~ '^brochures/.+'::text)),
  CONSTRAINT "canonical_brochures_id_check" CHECK ((btrim(id) <> ''::text)),
  CONSTRAINT "canonical_brochures_page_count_check" CHECK ((page_count > 0)),
  CONSTRAINT "canonical_brochures_pkey" PRIMARY KEY (id),
  CONSTRAINT "canonical_brochures_title_check" CHECK ((btrim(title) <> ''::text)),
  CONSTRAINT "canonical_brochures_validity" CHECK ((valid_until >= valid_from)),
  CONSTRAINT "canonical_brochures_verified_sha256_check" CHECK ((verified_sha256 ~ '^[a-f0-9]{64}$'::text))
);

ALTER TABLE "public"."canonical_brochures"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."canonical_brochures" FROM "anon", "service_role";

CREATE OR REPLACE FUNCTION private.canonical_brochure_pages_are_valid (
  p_pages      jsonb,
  p_page_count integer
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  STRICT
  SET search_path TO 'pg_catalog'
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."replace_canonical_brochure_catalog"(jsonb, text[]) FROM PUBLIC, "anon", "authenticated";

ALTER TABLE "public"."brochure_availability"
  ADD CONSTRAINT "brochure_availability_canonical_brochure_id_fkey" FOREIGN KEY (canonical_brochure_id) REFERENCES public.canonical_brochures(id) ON DELETE CASCADE;

ALTER TABLE "public"."canonical_brochures"
  ADD CONSTRAINT "canonical_brochures_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.brochure_stores(id);

CREATE POLICY "brochure_availability_select" ON "public"."brochure_availability"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "canonical_brochures_select" ON "public"."canonical_brochures"
  FOR SELECT
  TO "authenticated"
  USING (true);

COMMENT ON FUNCTION "public"."replace_canonical_brochure_catalog"(jsonb, text[]) IS 'Veroeffentlicht Bild-Cluster und ersetzt Verfuegbarkeiten nur fuer vollstaendig gecrawlte PLZ.';

COMMENT ON TABLE "public"."brochure_availability" IS 'Verknuepft jeden Bild-Cluster mit den PLZ, an denen er verfuegbar ist.';

COMMENT ON TABLE "public"."canonical_brochures" IS 'Bild-Cluster mit verifiziertem SHA-256, vollstaendigen Seiten samt Hotspots und privaten R2-Objektschluesseln.';

REVOKE ALL ON FUNCTION "private"."canonical_brochure_pages_are_valid"(jsonb, integer) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."replace_canonical_brochure_catalog"(jsonb, text[]) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."replace_canonical_brochure_catalog"(jsonb, text[]) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."replace_canonical_brochure_catalog"(jsonb, text[]) TO "service_role";

REVOKE ALL ON TABLE "public"."brochure_availability" FROM "authenticated";

GRANT SELECT ON TABLE "public"."brochure_availability" TO "authenticated";

REVOKE ALL ON TABLE "public"."brochure_stores" FROM "authenticated";

GRANT SELECT ON TABLE "public"."brochure_stores" TO "authenticated";

REVOKE ALL ON TABLE "public"."brochure_stores" FROM "service_role";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."brochure_stores" TO "service_role";

REVOKE ALL ON TABLE "public"."canonical_brochures" FROM "authenticated";

GRANT SELECT ON TABLE "public"."canonical_brochures" TO "authenticated";

ALTER TABLE "public"."canonical_brochures"
  ADD CONSTRAINT "canonical_brochures_pages_valid" CHECK (private.canonical_brochure_pages_are_valid(pages, page_count));
