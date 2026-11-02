begin;
\ir helpers.sql

select plan(10);

select tests.create_user('5f5d6f83-2a53-4243-b3dc-219f15d91234', 'brochure-retries@example.com');
select tests.as_postgres();
select vault.create_secret(
  'https://example.supabase.co/functions/v1/dispatch-brochure-scan',
  'brochure_dispatch_function_url'
);
select vault.create_secret('test-webhook-secret', 'brochure_dispatch_webhook_secret');

select tests.authenticate_as('5f5d6f83-2a53-4243-b3dc-219f15d91234');
select lives_ok(
  $$select * from public.request_brochure_zip_scan('30159')$$,
  'a supported scan can be requested before retries'
);

set local role service_role;
select public.record_brochure_zip_scan_failure('30159', 'first failure');
select ok(
  (select next_attempt_at > now() from public.brochure_zip_scans where zip_code = '30159'),
  'the first failure keeps the one-hour retry backoff'
);
select is(
  (select count(*) from public.get_pending_brochure_zip_scans(25) where zip_code = '30159'),
  0::bigint,
  'a failed scan is not pending during its backoff'
);

update public.brochure_zip_scans
set next_attempt_at = now() - interval '1 second'
where zip_code = '30159';
select is(
  (select count(*) from public.get_pending_brochure_zip_scans(25) where zip_code = '30159'),
  1::bigint,
  'the first retry becomes pending after backoff'
);

select public.record_brochure_zip_scan_failure('30159', 'second failure');
update public.brochure_zip_scans
set next_attempt_at = now() - interval '1 second'
where zip_code = '30159';
select is(
  (select count(*) from public.get_pending_brochure_zip_scans(25) where zip_code = '30159'),
  1::bigint,
  'the second automatic retry remains available'
);

select public.record_brochure_zip_scan_failure('30159', 'third failure');
update public.brochure_zip_scans
set next_attempt_at = now() - interval '1 second'
where zip_code = '30159';
select is(
  (select count(*) from public.get_pending_brochure_zip_scans(25) where zip_code = '30159'),
  1::bigint,
  'the third automatic retry remains available'
);

select public.record_brochure_zip_scan_failure('30159', 'fourth failure');
update public.brochure_zip_scans
set next_attempt_at = now() - interval '1 second'
where zip_code = '30159';
select is(
  (select count(*) from public.get_pending_brochure_zip_scans(25) where zip_code = '30159'),
  0::bigint,
  'the queue stops after three automatic retries'
);
reset role;

select tests.authenticate_as('5f5d6f83-2a53-4243-b3dc-219f15d91234');
select lives_ok(
  $$select * from public.request_brochure_zip_scan('30159')$$,
  'an account can request a fresh attempt after automatic retries are exhausted'
);
select tests.as_postgres();
select ok(
  (select attempt_count = 0 and last_error is null from public.brochure_zip_scans where zip_code = '30159'),
  'a user retry clears exhausted retry state'
);
select is(
  (select count(*) from net.http_request_queue where convert_from(body, 'UTF8')::jsonb -> 'record' ->> 'zip_code' = '30159'),
  2::bigint,
  'the fresh user retry creates one additional dispatch'
);

select * from finish();
rollback;
