begin;
\ir helpers.sql

select no_plan();

select tests.create_user('90909090-9090-4090-8090-909090909090', 'regional-brochures@example.com');
select tests.as_postgres();

insert into public.brochure_stores (id, name, logo_url)
values (
  'regional_brochures_test_store',
  'Regional brochures test store',
  'https://offerscdn.bringapi.app/content/offers/test/logo.png'
);

select has_table('public', 'canonical_brochures', 'the BRN catalog table exists');
select has_table('public', 'brochure_availability', 'the PLZ availability table exists');
select has_column(
  'public', 'canonical_brochures', 'source_zip_code',
  'each brochure retains the region used to fetch its details'
);
select ok(
  (select is_nullable = 'NO'
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'canonical_brochures'
     and column_name = 'source_zip_code'),
  'each brochure requires its source region'
);
select hasnt_column(
  'public', 'canonical_brochures', 'verified_sha256',
  'the catalog no longer requires downloaded image hashes'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.canonical_brochures'::regclass),
  'the catalog has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.brochure_availability'::regclass),
  'availability has RLS enabled'
);
select ok(
  has_table_privilege('authenticated', 'public.canonical_brochures', 'select'),
  'authenticated users can read the catalog'
);
select ok(
  has_table_privilege('authenticated', 'public.brochure_availability', 'select'),
  'authenticated users can read PLZ availability'
);
select ok(
  not has_table_privilege('authenticated', 'public.canonical_brochures', 'insert,update,delete'),
  'authenticated users cannot write catalog rows directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.brochure_availability', 'insert,update,delete'),
  'authenticated users cannot write availability directly'
);
select ok(
  not has_table_privilege('anon', 'public.canonical_brochures', 'select'),
  'anonymous users cannot read the catalog'
);
select ok(
  not has_table_privilege('service_role', 'public.canonical_brochures', 'insert,update,delete'),
  'service role writes through the catalog RPC'
);
select ok(
  has_table_privilege('service_role', 'public.canonical_brochures', 'select'),
  'service role can reuse the published catalog metadata'
);
select ok(
  has_function_privilege(
    'service_role', 'public.replace_canonical_brochure_catalog(jsonb,text[])', 'execute'
  ),
  'service role can publish the catalog'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.replace_canonical_brochure_catalog(jsonb,text[])', 'execute'
  ),
  'authenticated users cannot publish the catalog'
);

select ok(
  private.bring_image_url_is_valid(
    'https://offerscdn.bringapi.app/content/offers/de/page.jpg?width=800&format=webp'
  ),
  'the source validator accepts Bring CDN URLs and query parameters'
);
select is(private.bring_image_url_is_valid(null), false, 'null is not a source URL');
select is(
  private.bring_image_url_is_valid('https://bringapi.app/content/page.jpg'),
  false,
  'the Bring apex domain is not accepted'
);
select is(
  private.bring_image_url_is_valid('https://offerscdn.bringapi.app.attacker.test/content/page.jpg'),
  false,
  'a Bring-looking suffix on another host is rejected'
);
select is(
  private.bring_image_url_is_valid('http://offerscdn.bringapi.app/content/page.jpg'),
  false,
  'plain HTTP is rejected'
);
select is(
  private.bring_image_url_is_valid('https://user:pass@offerscdn.bringapi.app/content/page.jpg'),
  false,
  'URL credentials are rejected'
);
select is(
  private.bring_image_url_is_valid('https://offerscdn.bringapi.app:8443/content/page.jpg'),
  false,
  'custom ports are rejected'
);
select is(
  private.bring_image_url_is_valid('https://offerscdn.bringapi.app/content/page.jpg#fragment'),
  false,
  'URL fragments are rejected'
);
select is(
  private.bring_image_url_is_valid('https://offerscdn.bringapi.app/content/'),
  false,
  'an empty image path is rejected'
);
select is(
  private.bring_image_url_is_valid('https://offerscdn.bringapi.app/content/a//page.jpg'),
  false,
  'empty path segments are rejected'
);
select is(
  private.bring_image_url_is_valid('https://offerscdn.bringapi.app/content/../secret.jpg'),
  false,
  'literal path traversal is rejected'
);
select is(
  private.bring_image_url_is_valid('https://offerscdn.bringapi.app/content/%2e%2e/secret.jpg'),
  false,
  'encoded path traversal is rejected'
);
select is(
  private.bring_image_url_is_valid('https://offerscdn.bringapi.app/content/a%2fsecret.jpg'),
  false,
  'encoded path separators are rejected'
);
select is(
  private.bring_image_url_is_valid('https://offerscdn.bringapi.app/content/%ZZ.jpg'),
  false,
  'malformed percent encoding is rejected'
);
select ok(
  private.bring_image_url_is_valid('https://offerscdn.bringapi.app/content/page.jpg?variant=../large'),
  'query values are preserved without being mistaken for path traversal'
);
select is(
  private.canonical_brochure_pages_are_valid(
    '[{"number":1,"imageUrl":"https://offerscdn.bringapi.app/content/page.jpg","hotspots":[]}]'::jsonb,
    1
  ),
  true,
  'complete source-backed page data is valid'
);
select is(
  private.canonical_brochure_pages_are_valid(null, 1),
  false,
  'null page data is invalid'
);
select is(
  private.canonical_brochure_pages_are_valid(
    '[{"number":1,"hotspots":[]}]'::jsonb,
    1
  ),
  false,
  'a page without an image URL is invalid'
);
select is(
  private.canonical_brochure_pages_are_valid(
    '[{"number":2,"imageUrl":"https://offerscdn.bringapi.app/content/page.jpg","hotspots":[]}]'::jsonb,
    1
  ),
  false,
  'page numbering must be contiguous and start at one'
);
select is(
  private.canonical_brochure_pages_are_valid(
    '[{"number":1,"imageUrl":"https://offerscdn.bringapi.app/content/page.jpg","hotspots":[{"imageUrl":"https://attacker.test/image.jpg"}]}]'::jsonb,
    1
  ),
  false,
  'hotspot image URLs must use the allowed source host'
);
select is(
  private.canonical_brochure_pages_are_valid(
    '[{"number":1,"imageUrl":"https://offerscdn.bringapi.app/content/page.jpg","hotspots":["invalid"]}]'::jsonb,
    1
  ),
  false,
  'hotspots must be objects'
);

set local role service_role;
select lives_ok(
  $$select public.replace_canonical_brochure_catalog(
    '[
      {
        "id":"canonical:shared-brn",
        "canonical_brn":"shared-brn",
        "source_zip_code":"10115",
        "store_id":"regional_brochures_test_store",
        "title":"October offers",
        "valid_from":"2026-10-01T22:01:00Z",
        "valid_until":"2026-10-07T21:59:00Z",
        "page_count":2,
        "cover_image":"https://offerscdn.bringapi.app/content/10115/cover.jpg?size=large",
        "pages":[
          {"number":1,"imageUrl":"https://offerscdn.bringapi.app/content/10115/page-1.jpg?size=large","hotspots":[{"kind":"discount","id":"berlin-offer","x":1,"y":2,"width":3,"height":4,"title":"Coffee"}]},
          {"number":2,"imageUrl":"https://offerscdn.bringapi.app/content/10115/page-2.jpg","hotspots":[]}
        ],
        "available_zip_codes":["10115","20095"]
      }
    ]'::jsonb,
    array['10115', '20095']::text[]
  )$$,
  'the service-role RPC publishes one BRN and its scanned PLZ availability'
);
reset role;

select tests.authenticate_as('90909090-9090-4090-8090-909090909090');
select results_eq(
  $$select id from public.canonical_brochures order by id$$,
  $$values ('canonical:shared-brn'::text)$$,
  'authenticated users read one catalog row for a BRN'
);
select results_eq(
  $$select source_zip_code || ':' || canonical_brn from public.canonical_brochures$$,
  $$values ('10115:shared-brn'::text)$$,
  'the detail-request ZIP is retained as source metadata'
);
select results_eq(
  $$select zip_code || ':' || canonical_brochure_id from public.brochure_availability order by zip_code$$,
  $$values ('10115:canonical:shared-brn'::text), ('20095:canonical:shared-brn'::text)$$,
  'availability links the BRN only to ZIPs from its listings'
);
select results_eq(
  $$select cover_image || ':' || (pages->0->>'imageUrl') from public.canonical_brochures where id = 'canonical:shared-brn'$$,
  $$values ('https://offerscdn.bringapi.app/content/10115/cover.jpg?size=large:https://offerscdn.bringapi.app/content/10115/page-1.jpg?size=large'::text)$$,
  'the RPC preserves the independent original cover and page source URLs'
);
select results_eq(
  $$select page_count::text || ':' || (pages->0->'hotspots'->0->>'title')
    from public.canonical_brochures where id = 'canonical:shared-brn'$$,
  $$values ('2:Coffee'::text)$$,
  'page metadata and hotspots survive publication'
);
select tests.as_postgres();
select throws_ok(
  $$insert into public.canonical_brochures (
      id, canonical_brn, source_zip_code, store_id, title, valid_from, valid_until,
      page_count, cover_image, pages
    ) values (
      'canonical:shared-brn-copy', 'shared-brn', '10115', 'regional_brochures_test_store', 'Duplicate BRN',
      '2026-10-01', '2026-10-07', 1, 'https://offerscdn.bringapi.app/content/cover.jpg',
      '[{"number":1,"imageUrl":"https://offerscdn.bringapi.app/content/page.jpg","hotspots":[]}]'::jsonb
    )$$,
  '23505', null,
  'the catalog enforces one row per BRN'
);
select tests.as_postgres();

set local role service_role;
select lives_ok(
  $$select public.replace_canonical_brochure_catalog(
    '[{
      "id":"canonical:new-brn",
      "canonical_brn":"new-brn",
      "source_zip_code":"10115",
      "store_id":"regional_brochures_test_store",
      "title":"New Berlin offers",
      "valid_from":"2026-10-08",
      "valid_until":"2026-10-14",
      "page_count":1,
      "cover_image":"https://offerscdn.bringapi.app/content/10115/new-page.jpg",
      "pages":[{"number":1,"imageUrl":"https://offerscdn.bringapi.app/content/10115/new-page.jpg","hotspots":[]}],
      "available_zip_codes":["10115"]
    }]'::jsonb,
    array['10115']::text[]
  )$$,
  'a partial crawl replaces only its scanned ZIP'
);
reset role;
select results_eq(
  $$select id from public.canonical_brochures order by id$$,
  $$values ('canonical:new-brn'::text), ('canonical:shared-brn'::text)$$,
  'partial replacement preserves catalog rows outside its scope'
);
select results_eq(
  $$select zip_code || ':' || canonical_brochure_id from public.brochure_availability order by zip_code$$,
  $$values ('10115:canonical:new-brn'::text), ('20095:canonical:shared-brn'::text)$$,
  'partial replacement updates only availability inside its scope'
);

set local role service_role;
select lives_ok(
  $$select public.replace_canonical_brochure_catalog('[]'::jsonb, array['20095']::text[])$$,
  'a complete scan with no offers publishes an empty result for that ZIP'
);
reset role;
select results_eq(
  $$select id from public.canonical_brochures order by id$$,
  $$values ('canonical:new-brn'::text)$$,
  'empty results remove only catalog entries no longer available anywhere'
);
select results_eq(
  $$select zip_code from public.brochure_availability order by zip_code$$,
  $$values ('10115'::text)$$,
  'empty scoped results do not remove availability from another ZIP'
);

set local role service_role;
select throws_ok(
  $$select public.replace_canonical_brochure_catalog(
    '[{
      "id":"outside-scope",
      "canonical_brn":"outside-scope",
      "source_zip_code":"20095",
      "store_id":"regional_brochures_test_store",
      "title":"Outside scope",
      "valid_from":"2026-10-15",
      "valid_until":"2026-10-21",
      "page_count":1,
      "cover_image":"https://offerscdn.bringapi.app/content/20095/cover.jpg",
      "pages":[{"number":1,"imageUrl":"https://offerscdn.bringapi.app/content/20095/page.jpg","hotspots":[]}],
      "available_zip_codes":["20095"]
    }]'::jsonb,
    array['10115']::text[]
  )$$,
  '22023', null,
  'the RPC rejects records outside its declared scan scope'
);
select throws_ok(
  $$select public.replace_canonical_brochure_catalog('[]'::jsonb, array['10115','10115']::text[])$$,
  '22023', null,
  'the RPC rejects duplicate ZIP codes in the scan scope'
);
select throws_ok(
  $$select public.replace_canonical_brochure_catalog(
    '[{
      "id":"canonical:source-not-available",
      "canonical_brn":"source-not-available",
      "source_zip_code":"10115",
      "store_id":"regional_brochures_test_store",
      "title":"Source ZIP missing",
      "valid_from":"2026-10-15",
      "valid_until":"2026-10-21",
      "page_count":1,
      "cover_image":"https://offerscdn.bringapi.app/content/10115/cover.jpg",
      "pages":[{"number":1,"imageUrl":"https://offerscdn.bringapi.app/content/10115/page.jpg","hotspots":[]}],
      "available_zip_codes":["20095"]
    }]'::jsonb,
    array['10115','20095']::text[]
  )$$,
  '22023', null,
  'the detail-request ZIP must also appear in scanned availability'
);
select throws_ok(
  $$select public.replace_canonical_brochure_catalog(
    '[
      {"id":"canonical:duplicate","canonical_brn":"duplicate","source_zip_code":"10115","available_zip_codes":["10115"]},
      {"id":"canonical:duplicate","canonical_brn":"duplicate","source_zip_code":"20095","available_zip_codes":["20095"]}
    ]'::jsonb,
    array['10115','20095']::text[]
  )$$,
  '22023', null,
  'the RPC rejects duplicate BRN records before writing'
);
reset role;
select is(
  (select count(*)::integer from public.canonical_brochures where id = 'canonical:new-brn'),
  1,
  'rejected publication leaves the prior catalog intact'
);

select throws_ok(
  $$insert into public.brochure_stores (id, name, logo_url)
    values ('invalid-logo-store', 'Invalid logo store', 'https://attacker.test/logo.jpg')$$,
  '23514', null,
  'nonempty store logos must use the allowed Bring image host'
);
select throws_ok(
  $$insert into public.canonical_brochures (
      id, canonical_brn, source_zip_code, store_id, title, valid_from, valid_until,
      page_count, cover_image, pages
    ) values (
      'external-cover', 'external-cover', '10115', 'regional_brochures_test_store', 'External cover',
      '2026-10-01', '2026-10-07', 1, 'https://attacker.test/cover.jpg',
      '[{"number":1,"imageUrl":"https://offerscdn.bringapi.app/content/page.jpg","hotspots":[]}]'::jsonb
    )$$,
  '23514', null,
  'cover images must retain a validated Bring source URL'
);
select throws_ok(
  $$insert into public.canonical_brochures (
      id, canonical_brn, source_zip_code, store_id, title, valid_from, valid_until,
      page_count, cover_image, pages
    ) values (
      'external-page', 'external-page', '10115', 'regional_brochures_test_store', 'External page',
      '2026-10-01', '2026-10-07', 1, 'https://offerscdn.bringapi.app/content/cover.jpg',
      '[{"number":1,"imageUrl":"https://attacker.test/page.jpg","hotspots":[]}]'::jsonb
    )$$,
  '23514', null,
  'page images must retain validated Bring source URLs'
);
select throws_ok(
  $$insert into public.canonical_brochures (
      id, canonical_brn, source_zip_code, store_id, title, valid_from, valid_until,
      page_count, cover_image, pages
    ) values (
      'missing-page', 'missing-page', '10115', 'regional_brochures_test_store', 'Missing page image',
      '2026-10-01', '2026-10-07', 1, 'https://offerscdn.bringapi.app/content/cover.jpg',
      '[{"number":1,"hotspots":[]}]'::jsonb
    )$$,
  '23514', null,
  'every published page needs a valid source URL'
);

select lives_ok(
  $$delete from public.canonical_brochures where id = 'canonical:new-brn'$$,
  'deleting a catalog row succeeds'
);
select is(
  (select count(*)::integer from public.brochure_availability where canonical_brochure_id = 'canonical:new-brn'),
  0,
  'availability cascades when its catalog row is deleted'
);

select * from finish();
rollback;
