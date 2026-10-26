begin;
\ir helpers.sql

select no_plan();

select tests.create_user('90909090-9090-4090-8090-909090909090', 'regional-brochures@example.com');
select tests.as_postgres();

select has_table('public', 'brochures', 'the brochure table exists');
select has_table('public', 'brochure_pages', 'the page table exists');
select has_table('public', 'brochure_availability', 'the PLZ availability table exists');
select has_table('public', 'brochure_zip_scans', 'the demand-driven scan queue exists');
select has_column('public', 'brochures', 'source_zip_code', 'each brochure retains its source PLZ');
select has_column('public', 'brochures', 'source_content_id', 'each brochure retains its KaufDA content id');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.brochures'::regclass),
  'brochures has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.brochure_pages'::regclass),
  'pages has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.brochure_availability'::regclass),
  'availability has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.brochure_zip_scans'::regclass),
  'the scan queue has RLS enabled'
);
select ok(
  has_table_privilege('authenticated', 'public.brochures', 'select'),
  'authenticated users can read brochures'
);
select ok(
  has_table_privilege('authenticated', 'public.brochure_pages', 'select'),
  'authenticated users can read pages'
);
select ok(
  not has_table_privilege('authenticated', 'public.brochures', 'insert,update,delete'),
  'authenticated users cannot write brochure rows directly'
);
select ok(
  not has_table_privilege('anon', 'public.brochures', 'select'),
  'anonymous users cannot read brochures'
);
select ok(
  has_function_privilege('service_role', 'public.replace_brochure_zip(text,jsonb)', 'execute'),
  'the runner can publish a complete PLZ scope'
);
select ok(
  has_function_privilege('authenticated', 'public.request_brochure_zip_scan(text)', 'execute'),
  'authenticated app users can enqueue their active PLZ'
);
select ok(
  not has_function_privilege('anon', 'public.request_brochure_zip_scan(text)', 'execute'),
  'anonymous users cannot enqueue scans'
);
select ok(
  not has_table_privilege('authenticated', 'public.brochure_zip_scans', 'select'),
  'app users cannot read the global scan queue'
);
select ok(
  not has_function_privilege('authenticated', 'public.replace_brochure_zip(text,jsonb)', 'execute'),
  'authenticated users cannot publish data'
);

select ok(
  private.bonial_image_url_is_valid(
    'https://content-media.bonial.biz/page-1.jpg?impolicy=zoomlarge'
  ),
  'the image validator accepts original Bonial CDN URLs'
);
select is(
  private.bonial_image_url_is_valid('https://content-media.bonial.biz.attacker.test/page.jpg'),
  false,
  'a Bonial-looking suffix on another host is rejected'
);
select is(
  private.bonial_image_url_is_valid('http://content-media.bonial.biz/page.jpg'),
  false,
  'plain HTTP is rejected'
);
select is(
  private.bonial_image_url_is_valid('https://content-media.bonial.biz/../secret.jpg'),
  false,
  'literal path traversal is rejected'
);
select is(
  private.bonial_image_url_is_valid('https://content-media.bonial.biz/%2e%2e/secret.jpg'),
  false,
  'encoded path traversal is rejected'
);
select is(
  private.bonial_image_url_is_valid('https://content-media.bonial.biz/page.jpg#fragment'),
  false,
  'URL fragments are rejected'
);
select is(
  private.brochure_pages_are_valid(
    '[{"page_number":1,"image_url":"https://content-media.bonial.biz/page-1.jpg","hotspots":[]}]'::jsonb,
    1
  ),
  true,
  'a complete page set with original source URLs is valid'
);
select is(
  private.brochure_pages_are_valid(
    '[{"page_number":1,"image_url":"https://content-media.bonial.biz/page-1.jpg","hotspots":[{"id":"offer-1","kind":"discount","title":"Apples","x":10,"y":20,"width":30,"height":40}]}]'::jsonb,
    1
  ),
  true,
  'a positioned offer is valid'
);
select is(
  private.brochure_pages_are_valid(
    '[{"page_number":1,"image_url":"https://content-media.bonial.biz/page-1.jpg","hotspots":[{"id":"offer-1","title":"Apples","x":10,"y":20,"width":30,"height":40}]}]'::jsonb,
    1
  ),
  false,
  'an offer missing its app discriminator is rejected'
);
select is(
  private.brochure_pages_are_valid(
    '[{"page_number":1,"image_url":"https://content-media.bonial.biz/page-1.jpg","hotspots":[{"id":"offer-1","kind":"discount","title":"Apples","x":90,"y":20,"width":30,"height":40}]}]'::jsonb,
    1
  ),
  false,
  'an offer outside the page boundary is rejected'
);
select is(
  private.brochure_pages_are_valid(
    '[{"page_number":2,"image_url":"https://content-media.bonial.biz/page-1.jpg","hotspots":[]}]'::jsonb,
    1
  ),
  false,
  'page numbering must be contiguous and start at one'
);

select tests.authenticate_as('90909090-9090-4090-8090-909090909090');
select lives_ok(
  $$select * from public.request_brochure_zip_scan('30301')$$,
  'the app can request only an authenticated PLZ scan'
);
select ok(
  (select status.requested_at = queue.requested_at
   from public.get_brochure_zip_scan_status('30301') as status
   cross join lateral public.request_brochure_zip_scan('30301') as queue),
  'repeated app opens do not enqueue a duplicate scan'
);
reset role;

set local role service_role;
select results_eq(
  $$select zip_code from public.get_pending_brochure_zip_scans(25)$$,
  $$values ('30301'::text)$$,
  'the runner receives only a postal code explicitly requested by the app'
);
select lives_ok(
  $$select public.record_brochure_zip_scan_failure('30301', 'source unavailable')$$,
  'a failed run is recorded for delayed retry'
);
select is(
  (select attempt_count from public.brochure_zip_scans where zip_code = '30301'),
  1,
  'failure increments its retry count'
);
select is(
  (select count(*) from public.get_pending_brochure_zip_scans(25)),
  0::bigint,
  'a failed PLZ is delayed instead of queried on every scheduler tick'
);
reset role;

set local role service_role;
select lives_ok(
  $$select public.replace_brochure_zip(
    '10115',
    '[{
      "id":"kaufda:10115:kaufda:publisher-1:shared-content",
      "source_content_id":"shared-content",
      "source_zip_code":"10115",
      "store_id":"kaufda:publisher-1",
      "store_name":"Publisher One",
      "title":"October offers Berlin",
      "valid_from":"2026-10-01T22:01:00Z",
      "valid_until":"2026-10-30T21:59:00Z",
      "cover_image":"https://content-media.bonial.biz/10115/page-1.jpg",
      "page_count":1,
      "pages":[{"page_number":1,"image_url":"https://content-media.bonial.biz/10115/page-1.jpg","hotspots":[]}],
      "available_zip_codes":["10115"]
    }]'::jsonb
  )$$,
  'the runner publishes one complete regional brochure'
);
select ok(
  (select scan.last_successful_at >= scan.requested_at
   from public.brochure_zip_scans as scan where scan.zip_code = '10115'),
  'publishing a complete PLZ marks that requested scan complete'
);
reset role;
update public.brochure_zip_scans
set requested_at = now() - interval '1 day',
    last_successful_at = now() - interval '1 day'
where zip_code = '10115';
select tests.authenticate_as('90909090-9090-4090-8090-909090909090');
select results_eq(
  $$select requested_at = last_successful_at
    from public.request_brochure_zip_scan('10115')$$,
  $$values (true)$$,
  'a successful scan remains fresh for five days'
);
reset role;
update public.brochure_zip_scans
set requested_at = now() - interval '6 days',
    last_successful_at = now() - interval '6 days'
where zip_code = '10115';
select tests.authenticate_as('90909090-9090-4090-8090-909090909090');
select results_eq(
  $$select requested_at > last_successful_at
    from public.request_brochure_zip_scan('10115')$$,
  $$values (true)$$,
  'a scan older than five days is enqueued again when the PLZ is requested'
);
reset role;
set local role service_role;
select results_eq(
  $$select id || ':' || name from public.brochure_stores where id = 'kaufda:publisher-1'$$,
  $$values ('kaufda:publisher-1:Publisher One'::text)$$,
  'publish discovers and upserts the publisher from KaufDA metadata'
);
select lives_ok(
  $$select public.replace_brochure_zip(
    '20095',
    '[{
      "id":"kaufda:20095:kaufda:publisher-1:shared-content",
      "source_content_id":"shared-content",
      "source_zip_code":"20095",
      "store_id":"kaufda:publisher-1",
      "store_name":"Publisher One",
      "title":"October offers Hamburg",
      "valid_from":"2026-10-01T22:01:00Z",
      "valid_until":"2026-10-30T21:59:00Z",
      "cover_image":"https://content-media.bonial.biz/20095/page-1.jpg",
      "page_count":1,
      "pages":[{"page_number":1,"image_url":"https://content-media.bonial.biz/20095/page-1.jpg","hotspots":[]}],
      "available_zip_codes":["20095"]
    }]'::jsonb
  )$$,
  'the same source content id is published as a separate brochure for another PLZ'
);
select throws_ok(
  $$select public.replace_brochure_zip(
    '10115',
    '[{"id":"kaufda:10115:kaufda:publisher-1:incomplete","source_content_id":"incomplete","source_zip_code":"10115","store_id":"kaufda:publisher-1","store_name":"Publisher One"}]'::jsonb
  )$$,
  '22023',
  null,
  'an incomplete scan is rejected before replacing a PLZ scope'
);
reset role;

select tests.authenticate_as('90909090-9090-4090-8090-909090909090');
select results_eq(
  $$select id from public.brochures order by id$$,
  $$values ('kaufda:10115:kaufda:publisher-1:shared-content'::text), ('kaufda:20095:kaufda:publisher-1:shared-content'::text)$$,
  'users can read separate regional brochure copies'
);
select results_eq(
  $$select source_zip_code || ':' || source_content_id from public.brochures order by source_zip_code$$,
  $$values ('10115:shared-content'::text), ('20095:shared-content'::text)$$,
  'each copy retains the PLZ used for its detail request'
);
select results_eq(
  $$select zip_code || ':' || brochure_id from public.brochure_availability order by zip_code$$,
  $$values ('10115:kaufda:10115:kaufda:publisher-1:shared-content'::text), ('20095:kaufda:20095:kaufda:publisher-1:shared-content'::text)$$,
  'availability links each copy only to its own PLZ'
);
select is((select count(*) from public.brochure_pages), 2::bigint, 'all published pages are readable');
select throws_ok(
  $$insert into public.brochures (id, source_content_id, source_zip_code, store_id, title, valid_from, valid_until, cover_image, page_count)
    values ('unauthorized', 'unauthorized', '10115', 'kaufda:publisher-1', 'No access', now(), now(), 'https://content-media.bonial.biz/page.jpg', 1)$$,
  '42501',
  null,
  'authenticated users cannot insert brochure data'
);

set local role service_role;
select lives_ok(
  $$select public.replace_brochure_zip('10115', '[]'::jsonb)$$,
  'a complete empty scan may remove only its own PLZ scope'
);
reset role;
select tests.authenticate_as('90909090-9090-4090-8090-909090909090');
select is(
  (select count(*) from public.brochures where source_zip_code = '10115'),
  0::bigint,
  'an empty complete scan clears the selected PLZ'
);
select is(
  (select count(*) from public.brochures where source_zip_code = '20095'),
  1::bigint,
  'clearing one PLZ does not affect another PLZ'
);

select * from finish();
rollback;
