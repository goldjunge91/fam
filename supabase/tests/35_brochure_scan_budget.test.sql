begin;
\ir helpers.sql

select plan(23);

select is(
  pg_catalog.array_length(private.brochure_supported_zip_codes(), 1),
  10813,
  'the server-side postal-code list matches the GeoNames source size'
);
select ok(
  '22043' = any (private.brochure_supported_zip_codes()),
  'the server-side postal-code list accepts a supported postal code'
);
select ok(
  not ('00000' = any (private.brochure_supported_zip_codes())),
  'the server-side postal-code list rejects an unsupported postal code'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'private.brochure_scan_budget_events'::regclass),
  'the private budget event table has RLS enabled'
);
select ok(
  not has_table_privilege('authenticated', 'private.brochure_scan_budget_events', 'select,insert,update,delete')
    and not has_table_privilege('service_role', 'private.brochure_scan_budget_events', 'select,insert,update,delete')
    and not has_sequence_privilege('authenticated', 'private.brochure_scan_budget_events_id_seq', 'usage,select,update')
    and not has_sequence_privilege('service_role', 'private.brochure_scan_budget_events_id_seq', 'usage,select,update'),
  'clients and service_role cannot access private budget events or their sequence'
);
select ok(
  not has_function_privilege('authenticated', 'private.brochure_supported_zip_codes()', 'execute')
    and not has_function_privilege('service_role', 'private.brochure_supported_zip_codes()', 'execute'),
  'clients and service_role cannot read the full supported postal-code list'
);

select tests.create_user('2c5166d0-daa4-47bf-a8d9-bf616346c999', 'brochure-budget-one@example.com');
select tests.create_user('3a6770b0-2ac1-4ace-930b-75088c951234', 'brochure-budget-two@example.com');
select tests.create_user('40b103f1-5a4b-4b8b-a1c0-31ab31de1111', 'brochure-budget-global@example.com');
select tests.as_postgres();
select vault.create_secret(
  'https://example.supabase.co/functions/v1/dispatch-brochure-scan',
  'brochure_dispatch_function_url'
);
select vault.create_secret('test-webhook-secret', 'brochure_dispatch_webhook_secret');

select tests.authenticate_as('2c5166d0-daa4-47bf-a8d9-bf616346c999');
select lives_ok(
  $$select * from public.request_brochure_zip_scan('22043')$$,
  'a supported first scan is admitted'
);
select lives_ok(
  $$select * from public.request_brochure_zip_scan('22043')$$,
  'a duplicate pending request does not use another enqueue budget'
);
select lives_ok(
  $$select * from public.request_brochure_zip_scan('20095')$$,
  'the same account may request a second new postal code'
);
select lives_ok(
  $$select * from public.request_brochure_zip_scan('01067')$$,
  'the same account may request a third new postal code'
);
select throws_ok(
  $$select * from public.request_brochure_zip_scan('01069')$$,
  'P0001',
  'brochure_scan_account_budget_exceeded',
  'the fourth new postal code exceeds the account budget'
);

select tests.as_postgres();
select is(
  (select count(*) from private.brochure_scan_budget_events where user_id = '2c5166d0-daa4-47bf-a8d9-bf616346c999'),
  3::bigint,
  'duplicate requests do not add account budget events'
);
select is(
  (select count(*) from public.brochure_zip_scans where zip_code = '01069'),
  0::bigint,
  'account budget rejection creates no queue row'
);
select is(
  (select count(*) from net.http_request_queue where convert_from(body, 'UTF8')::jsonb -> 'record' ->> 'zip_code' = '01069'),
  0::bigint,
  'account budget rejection creates no webhook request'
);
select is(
  (select count(*) from public.brochure_zip_scans where zip_code = '22043'),
  1::bigint,
  'a pending postal code has only one queue row'
);

select tests.authenticate_as('3a6770b0-2ac1-4ace-930b-75088c951234');
select lives_ok(
  $$select * from public.request_brochure_zip_scan('01069')$$,
  'another account has its own enqueue budget'
);
select tests.as_postgres();
select is(
  (select count(*) from private.brochure_scan_budget_events where user_id = '3a6770b0-2ac1-4ace-930b-75088c951234'),
  1::bigint,
  'the second account has an independent budget event'
);

insert into private.brochure_scan_budget_events (user_id, created_at)
select '40b103f1-5a4b-4b8b-a1c0-31ab31de1111', pg_catalog.clock_timestamp()
from pg_catalog.generate_series(1, 20);

select tests.authenticate_as('3a6770b0-2ac1-4ace-930b-75088c951234');
select lives_ok(
  $$select * from public.request_brochure_zip_scan('01108')$$,
  'the twenty-fifth global scan is admitted'
);
select throws_ok(
  $$select * from public.request_brochure_zip_scan('01219')$$,
  'P0001',
  'brochure_scan_global_budget_exceeded',
  'the next new scan exceeds the global budget'
);

select tests.as_postgres();
select is(
  (select count(*) from private.brochure_scan_budget_events where user_id = '3a6770b0-2ac1-4ace-930b-75088c951234'),
  2::bigint,
  'a global rejection does not consume the account budget'
);
select is(
  (select count(*) from public.brochure_zip_scans where zip_code = '01219'),
  0::bigint,
  'global budget rejection creates no queue row'
);
select is(
  (select count(*) from net.http_request_queue where convert_from(body, 'UTF8')::jsonb -> 'record' ->> 'zip_code' = '01219'),
  0::bigint,
  'global budget rejection creates no webhook request'
);

insert into public.brochure_zip_scans (zip_code)
select supported.zip_code
from pg_catalog.unnest(private.brochure_supported_zip_codes()) as supported(zip_code)
where not exists (
  select 1 from public.brochure_zip_scans as scan where scan.zip_code = supported.zip_code
)
order by supported.zip_code
limit 26;

select is(
  (select count(*) from public.get_pending_brochure_zip_scans(100)),
  25::bigint,
  'one queue read returns at most twenty-five scans'
);

select * from finish();
rollback;
