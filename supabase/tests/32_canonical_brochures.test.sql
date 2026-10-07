begin;
\ir helpers.sql

select plan(53);

select tests.create_user('90909090-9090-4090-8090-909090909090', 'canonical-brochures@example.com');
select tests.as_postgres();

insert into public.brochure_stores (id, name)
values ('canonical_schema_test_store', 'Canonical schema test store');

select has_table(
  'public', 'canonical_brochures',
  'canonical_brochures stores the shared brochure catalog'
);
select has_table(
  'public', 'brochure_availability',
  'brochure_availability maps catalog rows to ZIP codes'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'canonical_brochures'
      and indexname = 'canonical_brochures_store_id_idx'
  ),
  'canonical_brochures indexes its store foreign key'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'brochure_availability'
      and indexname = 'brochure_availability_canonical_brochure_id_idx'
  ),
  'brochure_availability indexes its cascading foreign key'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'favorite_brochure_stores'
      and indexname = 'favorite_brochure_stores_store_id_idx'
  ),
  'favorite_brochure_stores indexes its store foreign key'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.canonical_brochures'::regclass),
  'canonical_brochures has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.brochure_availability'::regclass),
  'brochure_availability has RLS enabled'
);
select ok(
  has_table_privilege('authenticated', 'public.canonical_brochures', 'select'),
  'authenticated can read canonical_brochures'
);
select ok(
  not has_table_privilege('authenticated', 'public.canonical_brochures', 'insert,update,delete'),
  'authenticated cannot change canonical_brochures directly'
);
select ok(
  has_table_privilege('authenticated', 'public.brochure_availability', 'select'),
  'authenticated can read brochure_availability'
);
select ok(
  not has_table_privilege('authenticated', 'public.brochure_availability', 'insert,update,delete'),
  'authenticated cannot change brochure_availability directly'
);
select ok(
  not has_table_privilege('anon', 'public.canonical_brochures', 'select'),
  'anon cannot read canonical_brochures'
);
select ok(
  not has_table_privilege('anon', 'public.brochure_availability', 'select'),
  'anon cannot read brochure_availability'
);
select ok(
  not has_table_privilege('service_role', 'public.canonical_brochures', 'insert,update,delete'),
  'service_role writes the catalog through the RPC only'
);
select ok(
  not has_table_privilege('service_role', 'public.brochure_availability', 'insert,update,delete'),
  'service_role writes availability through the RPC only'
);
select ok(
  has_function_privilege(
    'service_role', 'public.replace_canonical_brochure_catalog(jsonb,text[])', 'execute'
  ),
  'service_role can replace the catalog'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.replace_canonical_brochure_catalog(jsonb,text[])', 'execute'
  ),
  'authenticated cannot replace the catalog'
);
select ok(
  not has_function_privilege(
    'anon', 'public.replace_canonical_brochure_catalog(jsonb,text[])', 'execute'
  ),
  'anon cannot replace the catalog'
);
set local role service_role;
select lives_ok(
  $$select public.replace_canonical_brochure_catalog(
    '[
      {
        "id":"cluster-a",
        "canonical_brn":"brn-a",
        "store_id":"canonical_schema_test_store",
        "title":"October offers",
        "valid_from":"2026-10-01T22:01:00Z",
        "valid_until":"2026-10-07T21:59:00Z",
        "page_count":2,
        "cover_image":"brochures/test/a/cover.jpg",
        "pages":[
          {"number":1,"imageUrl":"brochures/test/a/page-001.jpg","hotspots":[{"kind":"discount","id":"a1","x":1,"y":2,"width":3,"height":4,"title":"Coffee"}]},
          {"number":2,"imageUrl":"brochures/test/a/page-002.jpg","hotspots":[]}
        ],
        "verified_sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "available_zip_codes":["10115","20095"]
      },
      {
        "id":"cluster-b",
        "canonical_brn":"brn-b",
        "store_id":"canonical_schema_test_store",
        "title":"October offers, regional version",
        "valid_from":"2026-10-01",
        "valid_until":"2026-10-07",
        "page_count":1,
        "cover_image":"brochures/test/b/cover.jpg",
        "pages":[{"number":1,"imageUrl":"brochures/test/b/page-001.jpg","hotspots":[]}],
        "verified_sha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "available_zip_codes":["10115"]
      }
    ]'::jsonb,
    array['10115', '20095']::text[]
  )$$,
  'the service-role RPC inserts records and ZIP availability'
);
reset role;

select tests.authenticate_as('90909090-9090-4090-8090-909090909090');
select results_eq(
  $$select id from public.canonical_brochures order by id$$,
  $$values ('cluster-a'::text), ('cluster-b'::text)$$,
  'authenticated sees all canonical catalog rows'
);
select results_eq(
  $$select page_count::text || ':' || (pages->0->'hotspots'->0->>'title')
      from public.canonical_brochures where id = 'cluster-a'$$,
  $$values ('2:Coffee'::text)$$,
  'page data and nested hotspots survive the RPC as supplied'
);
select is(
  (select valid_from from public.canonical_brochures where id = 'cluster-a'),
  '2026-10-01T22:01:00Z'::timestamptz,
  'the catalog preserves source validity timestamps'
);
select results_eq(
  $$select zip_code from public.brochure_availability
      where canonical_brochure_id = 'cluster-a' order by zip_code$$,
  $$values ('10115'::text), ('20095'::text)$$,
  'the availability relation stores each ZIP for its catalog row'
);
select tests.as_postgres();

set local role service_role;
select lives_ok(
  $$select public.replace_canonical_brochure_catalog(
    '[
      {
        "id":"cluster-c",
        "canonical_brn":"brn-c",
        "store_id":"canonical_schema_test_store",
        "title":"Replacement catalog",
        "valid_from":"2026-10-08",
        "valid_until":"2026-10-14",
        "page_count":1,
        "cover_image":"brochures/test/c/cover.jpg",
        "pages":[{"number":1,"imageUrl":"brochures/test/c/page-001.jpg","hotspots":[]}],
        "verified_sha256":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "available_zip_codes":["10115"]
      },
      {
        "id":"cluster-d",
        "canonical_brn":"brn-d",
        "store_id":"canonical_schema_test_store",
        "title":"Replacement catalog at another ZIP",
        "valid_from":"2026-10-08",
        "valid_until":"2026-10-14",
        "page_count":1,
        "cover_image":"brochures/test/d/cover.jpg",
        "pages":[{"number":1,"imageUrl":"brochures/test/d/page-001.jpg","hotspots":[]}],
        "verified_sha256":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        "available_zip_codes":["20095"]
      }
    ]'::jsonb,
    array['10115', '20095']::text[]
  )$$,
  'a full-scope service-role call replaces the catalog'
);
reset role;

select is(
  (select count(*)::integer from public.canonical_brochures), 2,
  'replacement removes rows omitted from the new catalog'
);
select is(
  (select count(*)::integer from public.canonical_brochures where id = 'cluster-c'), 1,
  'replacement stores the new canonical row'
);
select is(
  (select count(*)::integer from public.brochure_availability
    where canonical_brochure_id in ('cluster-a', 'cluster-b')),
  0,
  'replacement removes availability belonging to the prior catalog'
);
select results_eq(
  $$select zip_code from public.brochure_availability
      where canonical_brochure_id = 'cluster-c' order by zip_code$$,
  $$values ('10115'::text)$$,
  'full replacement stores availability for the first ZIP'
);
select results_eq(
  $$select zip_code from public.brochure_availability
      where canonical_brochure_id = 'cluster-d' order by zip_code$$,
  $$values ('20095'::text)$$,
  'full replacement stores availability for the second ZIP'
);

set local role service_role;
select lives_ok(
  $$select public.replace_canonical_brochure_catalog(
    '[
      {
        "id":"cluster-e",
        "canonical_brn":"brn-e",
        "store_id":"canonical_schema_test_store",
        "title":"Partial crawl replacement",
        "valid_from":"2026-10-15",
        "valid_until":"2026-10-21",
        "page_count":1,
        "cover_image":"brochures/test/e/cover.jpg",
        "pages":[{"number":1,"imageUrl":"brochures/test/e/page-001.jpg","hotspots":[]}],
        "verified_sha256":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        "available_zip_codes":["10115"]
      }
    ]'::jsonb,
    array['10115']::text[]
  )$$,
  'a partial crawl replaces only availability inside its ZIP scope'
);
reset role;

select results_eq(
  $$select id from public.canonical_brochures order by id$$,
  $$values ('cluster-d'::text), ('cluster-e'::text)$$,
  'partial replacement keeps rows still available outside its ZIP scope'
);
select is(
  (select count(*)::integer from public.canonical_brochures where id = 'cluster-c'), 0,
  'partial replacement removes an old row with no remaining availability'
);
select results_eq(
  $$select zip_code from public.brochure_availability
      where canonical_brochure_id = 'cluster-d' order by zip_code$$,
  $$values ('20095'::text)$$,
  'partial replacement preserves availability outside its ZIP scope'
);
select results_eq(
  $$select zip_code from public.brochure_availability
      where canonical_brochure_id = 'cluster-e' order by zip_code$$,
  $$values ('10115'::text)$$,
  'partial replacement stores new availability inside its ZIP scope'
);

set local role service_role;
select throws_ok(
  $$select public.replace_canonical_brochure_catalog(
    '[
      {
        "id":"out-of-scope",
        "canonical_brn":"brn-out-of-scope",
        "store_id":"canonical_schema_test_store",
        "title":"Outside scope",
        "valid_from":"2026-10-15",
        "valid_until":"2026-10-21",
        "page_count":1,
        "cover_image":"brochures/test/out-of-scope/cover.jpg",
        "pages":[{"number":1,"imageUrl":"brochures/test/out-of-scope/page-001.jpg","hotspots":[]}],
        "verified_sha256":"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        "available_zip_codes":["20095"]
      }
    ]'::jsonb,
    array['10115']::text[]
  )$$,
  '22023', null,
  'the RPC rejects availability outside the declared crawl scope'
);
reset role;
select is(
  (select count(*)::integer from public.canonical_brochures), 2,
  'out-of-scope rejection leaves the published catalog untouched'
);
select results_eq(
  $$select zip_code || ':' || canonical_brochure_id from public.brochure_availability
      order by zip_code, canonical_brochure_id$$,
  $$values ('10115:cluster-e'::text), ('20095:cluster-d'::text)$$,
  'out-of-scope rejection preserves all existing availability'
);

set local role service_role;
select throws_ok(
  $$select public.replace_canonical_brochure_catalog(
    '[
      {
        "id":"duplicate-edge",
        "canonical_brn":"brn-duplicate-edge",
        "store_id":"canonical_schema_test_store",
        "title":"Duplicate availability input",
        "valid_from":"2026-10-15",
        "valid_until":"2026-10-21",
        "page_count":1,
        "cover_image":"brochures/test/duplicate-edge/cover.jpg",
        "pages":[{"number":1,"imageUrl":"brochures/test/duplicate-edge/page-001.jpg","hotspots":[]}],
        "verified_sha256":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "available_zip_codes":["10115","10115"]
      }
    ]'::jsonb,
    array['10115']::text[]
  )$$,
  '23505', null,
  'the RPC rejects duplicate availability edges'
);
reset role;
select is(
  (select count(*)::integer from public.canonical_brochures), 2,
  'duplicate availability input rolls back catalog writes'
);
select results_eq(
  $$select zip_code || ':' || canonical_brochure_id from public.brochure_availability
      order by zip_code, canonical_brochure_id$$,
  $$values ('10115:cluster-e'::text), ('20095:cluster-d'::text)$$,
  'duplicate availability input preserves existing ZIP links'
);

set local role service_role;
select throws_ok(
  $$select public.replace_canonical_brochure_catalog(
    '[
      {
        "id":"replacement-before-error",
        "canonical_brn":"brn-before-error",
        "store_id":"canonical_schema_test_store",
        "title":"Must roll back",
        "valid_from":"2026-10-08",
        "valid_until":"2026-10-14",
        "page_count":1,
        "cover_image":"brochures/test/rollback/cover.jpg",
        "pages":[{"number":1,"imageUrl":"brochures/test/rollback/page-001.jpg","hotspots":[]}],
        "verified_sha256":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        "available_zip_codes":["10115"]
      },
      {
        "id":"replacement-invalid-store",
        "canonical_brn":"brn-invalid-store",
        "store_id":"missing_store",
        "title":"Invalid foreign key",
        "valid_from":"2026-10-08",
        "valid_until":"2026-10-14",
        "page_count":1,
        "cover_image":"brochures/test/rollback-invalid/cover.jpg",
        "pages":[{"number":1,"imageUrl":"brochures/test/rollback-invalid/page-001.jpg","hotspots":[]}],
        "verified_sha256":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        "available_zip_codes":["10115"]
      }
    ]'::jsonb,
    array['10115']::text[]
  )$$,
  '23503', null,
  'a bad row aborts the complete replacement with its foreign-key error'
);
reset role;
select is(
  (select count(*)::integer from public.canonical_brochures), 2,
  'failed replacement preserves the previously published catalog'
);
select is(
  (select count(*)::integer from public.canonical_brochures
    where id in ('cluster-d', 'cluster-e', 'replacement-before-error', 'replacement-invalid-store')),
  2,
  'failed replacement leaves no partially inserted catalog rows'
);
select results_eq(
  $$select zip_code || ':' || canonical_brochure_id from public.brochure_availability
      order by zip_code, canonical_brochure_id$$,
  $$values ('10115:cluster-e'::text), ('20095:cluster-d'::text)$$,
  'failed replacement preserves scoped and out-of-scope availability'
);

select throws_ok(
  $$insert into public.canonical_brochures (
      id, canonical_brn, store_id, title, valid_from, valid_until,
      page_count, cover_image, pages, verified_sha256
    ) values (
      'bad-store', 'brn-bad-store', 'missing_store', 'Bad store',
      '2026-10-01', '2026-10-07', 1, 'brochures/test/bad-store/cover.jpg',
      '[{"number":1,"imageUrl":"brochures/test/bad-store/page.jpg","hotspots":[]}]'::jsonb,
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    )$$,
  '23503', null,
  'canonical_brochures requires a known brochure store'
);
select throws_ok(
  $$insert into public.brochure_availability (zip_code, canonical_brochure_id)
    values ('10115', 'missing_catalog_row')$$,
  '23503', null,
  'availability requires a canonical brochure row'
);
select throws_ok(
  $$insert into public.brochure_availability (zip_code, canonical_brochure_id)
    values ('10115', 'cluster-e')$$,
  '23505', null,
  'the ZIP and canonical brochure pair is unique'
);
select throws_ok(
  $$insert into public.canonical_brochures (
      id, canonical_brn, store_id, title, valid_from, valid_until,
      page_count, cover_image, pages, verified_sha256
    ) values (
      'bad-page-count', 'brn-bad-page-count', 'canonical_schema_test_store', 'Bad page count',
      '2026-10-01', '2026-10-07', 2, 'brochures/test/bad-count/cover.jpg',
      '[{"number":1,"imageUrl":"brochures/test/bad-count/page.jpg","hotspots":[]}]'::jsonb,
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    )$$,
  '23514', null,
  'page_count must match the stored page array'
);
select throws_ok(
  $$insert into public.canonical_brochures (
      id, canonical_brn, store_id, title, valid_from, valid_until,
      page_count, cover_image, pages, verified_sha256
    ) values (
      'bad-sha', 'brn-bad-sha', 'canonical_schema_test_store', 'Bad hash',
      '2026-10-01', '2026-10-07', 1, 'brochures/test/bad-sha/cover.jpg',
      '[{"number":1,"imageUrl":"brochures/test/bad-sha/page.jpg","hotspots":[]}]'::jsonb,
      'not-a-sha256'
    )$$,
  '23514', null,
  'verified_sha256 must be a lowercase SHA-256 digest'
);
select throws_ok(
  $$insert into public.canonical_brochures (
      id, canonical_brn, store_id, title, valid_from, valid_until,
      page_count, cover_image, pages, verified_sha256
    ) values (
      'external-cover', 'brn-external-cover', 'canonical_schema_test_store', 'External cover',
      '2026-10-01', '2026-10-07', 1, 'https://cdn.example.test/cover.jpg',
      '[{"number":1,"imageUrl":"brochures/test/external-cover/page.jpg","hotspots":[]}]'::jsonb,
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    )$$,
  '23514', null,
  'cover_image must be stored as an R2 object key'
);
select throws_ok(
  $$insert into public.canonical_brochures (
      id, canonical_brn, store_id, title, valid_from, valid_until,
      page_count, cover_image, pages, verified_sha256
    ) values (
      'external-page', 'brn-external-page', 'canonical_schema_test_store', 'External page',
      '2026-10-01', '2026-10-07', 1, 'brochures/test/external-page/cover.jpg',
      '[{"number":1,"imageUrl":"https://cdn.example.test/page.jpg","hotspots":[]}]'::jsonb,
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    )$$,
  '23514', null,
  'page image URLs must be stored as R2 object keys'
);
select lives_ok(
  $$delete from public.canonical_brochures where id = 'cluster-e'$$,
  'deleting a catalog row succeeds'
);
select is(
  (select count(*)::integer from public.brochure_availability
    where canonical_brochure_id = 'cluster-e'),
  0,
  'availability rows cascade when a canonical brochure is deleted'
);

select * from finish();
rollback;
