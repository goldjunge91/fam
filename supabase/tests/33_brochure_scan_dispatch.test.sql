begin;
\ir helpers.sql

select plan(4);

select tests.as_postgres();
select tests.create_user('c188c0a3-fdbf-47cf-8980-0a2c0064d3ff', 'brochure-dispatch@example.com');
select vault.create_secret(
  'https://example.supabase.co/functions/v1/dispatch-brochure-scan',
  'brochure_dispatch_function_url'
);
select vault.create_secret('test-webhook-secret', 'brochure_dispatch_webhook_secret');

select tests.authenticate_as('c188c0a3-fdbf-47cf-8980-0a2c0064d3ff');
select lives_ok(
  $$select * from public.request_brochure_zip_scan('22043')$$,
  'A new pending postal-code request commits and queues a webhook'
);

select tests.as_postgres();
select is(
  (
    select count(*)
    from net.http_request_queue
    where convert_from(body, 'UTF8')::jsonb -> 'record' ->> 'zip_code' = '22043'
  ),
  1::bigint,
  'The webhook payload contains only the requested postal code'
);

select tests.authenticate_as('c188c0a3-fdbf-47cf-8980-0a2c0064d3ff');
select lives_ok(
  $$select * from public.request_brochure_zip_scan('22043')$$,
  'Repeated reads while a scan is pending do not fail'
);

select tests.as_postgres();
select is(
  (
    select count(*)
    from net.http_request_queue
    where convert_from(body, 'UTF8')::jsonb -> 'record' ->> 'zip_code' = '22043'
  ),
  1::bigint,
  'A pending postal code is dispatched only once'
);

select * from finish();
rollback;
