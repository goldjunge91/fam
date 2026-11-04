begin;
\ir helpers.sql

select plan(12);

-- The first remote transaction must commit so the waiting request can observe
-- its budget event. Fixed fixture IDs make the committed rows removable after
-- the assertions; preconditions fail closed before any external dispatch.
create extension if not exists dblink with schema extensions;

create or replace function tests.wait_for_session_wait_event(
  p_application_name text,
  p_wait_event text
)
returns boolean
language plpgsql
as $$
declare
  v_deadline timestamptz := pg_catalog.clock_timestamp() + interval '2 seconds';
begin
  loop
    if exists (
      select 1
      from pg_catalog.pg_stat_activity as activity
      where activity.application_name = p_application_name
        and activity.wait_event = p_wait_event
    ) then
      return true;
    end if;

    exit when pg_catalog.clock_timestamp() >= v_deadline;
    perform pg_catalog.pg_sleep(0.02);
  end loop;

  return false;
end;
$$;

select extensions.dblink_connect(
  'h2_budget_first',
  pg_catalog.format(
    'host=supabase_db_fam port=5432 dbname=%s user=postgres password=postgres connect_timeout=3 application_name=h2_budget_first',
    pg_catalog.current_database()
  )
);
select extensions.dblink_connect(
  'h2_budget_second',
  pg_catalog.format(
    'host=supabase_db_fam port=5432 dbname=%s user=postgres password=postgres connect_timeout=3 application_name=h2_budget_second',
    pg_catalog.current_database()
  )
);

select extensions.dblink_exec(
  'h2_budget_first',
  $remote$
    do $block$
    begin
      if exists (
        select 1
        from vault.decrypted_secrets
        where name in (
          'brochure_dispatch_function_url',
          'brochure_dispatch_webhook_secret'
        )
      ) then
        raise exception 'h2_concurrency_test_requires_unconfigured_dispatch';
      end if;
      if exists (select 1 from private.brochure_scan_budget_events) then
        raise exception 'h2_concurrency_test_requires_empty_budget_events';
      end if;
      if exists (
        select 1
        from auth.users
        where id in (
          '94000000-0000-4000-8000-000000000001',
          '94000000-0000-4000-8000-000000000002',
          '94000000-0000-4000-8000-000000000003'
        )
      ) or exists (
        select 1
        from public.brochure_zip_scans
        where zip_code in ('01307', '01309')
      ) or exists (
        select 1
        from net.http_request_queue
        where convert_from(body, 'UTF8')::jsonb -> 'record' ->> 'zip_code'
          in ('01307', '01309')
      ) then
        raise exception 'h2_concurrency_test_fixtures_already_exist';
      end if;
    end;
    $block$;
  $remote$
);

select extensions.dblink_exec('h2_budget_first', 'begin');
select extensions.dblink_exec(
  'h2_budget_first',
  $remote$
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
    )
    values
      (
        '94000000-0000-4000-8000-000000000001',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'h2-budget-seed@example.invalid',
        'not-used', now(), now()
      ),
      (
        '94000000-0000-4000-8000-000000000002',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'h2-budget-first@example.invalid',
        'not-used', now(), now()
      ),
      (
        '94000000-0000-4000-8000-000000000003',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'h2-budget-second@example.invalid',
        'not-used', now(), now()
      );
    insert into private.brochure_scan_budget_events (user_id, created_at)
    select
      '94000000-0000-4000-8000-000000000001',
      pg_catalog.clock_timestamp()
    from pg_catalog.generate_series(1, 24);
    create function pg_temp.h2_admit_first_scan()
    returns timestamptz
    language plpgsql
    as $function$
    declare
      v_requested_at timestamptz;
    begin
      select requested.requested_at
      into strict v_requested_at
      from public.request_brochure_zip_scan('01307') as requested;
      perform pg_catalog.pg_sleep(3);
      return v_requested_at;
    end;
    $function$;
  $remote$
);
select extensions.dblink_exec('h2_budget_first', 'set local role authenticated');
select extensions.dblink_exec(
  'h2_budget_first',
  $remote$
    set local "request.jwt.claims" =
      '{"sub":"94000000-0000-4000-8000-000000000002","role":"authenticated"}'
  $remote$
);
select extensions.dblink_send_query(
  'h2_budget_first',
  'select pg_temp.h2_admit_first_scan()'
);
select ok(
  tests.wait_for_session_wait_event('h2_budget_first', 'PgSleep'),
  'the first request holds its transaction open after admission'
);

select extensions.dblink_exec('h2_budget_second', 'begin');
select extensions.dblink_exec('h2_budget_second', 'set local role authenticated');
select extensions.dblink_exec(
  'h2_budget_second',
  $remote$
    set local "request.jwt.claims" =
      '{"sub":"94000000-0000-4000-8000-000000000003","role":"authenticated"}'
  $remote$
);
select extensions.dblink_send_query(
  'h2_budget_second',
  'select * from public.request_brochure_zip_scan(''01309'')'
);
select pg_catalog.pg_sleep(0.1);
select is(
  extensions.dblink_is_busy('h2_budget_second'),
  1,
  'a different postal code remains pending behind the first admission'
);

select is(
  (
    select count(*)
    from extensions.dblink_get_result('h2_budget_first')
      as result(requested_at timestamptz)
  ),
  1::bigint,
  'the concurrent first request is admitted at the global boundary'
);
select count(*)
from extensions.dblink_get_result('h2_budget_first')
  as result(requested_at timestamptz);
select extensions.dblink_exec('h2_budget_first', 'commit');
select is(
  (
    select count(*)
    from extensions.dblink_get_result('h2_budget_second', false)
      as result(
        requested_at timestamptz,
        last_successful_at timestamptz,
        next_attempt_at timestamptz,
        last_error text
      )
  ),
  0::bigint,
  'the waiting request returns no scan after the budget is consumed'
);
select ok(
  extensions.dblink_error_message('h2_budget_second')
    like '%brochure_scan_global_budget_exceeded%',
  'the waiting request observes the committed global budget'
);
select count(*)
from extensions.dblink_get_result('h2_budget_second', false)
  as result(
    requested_at timestamptz,
    last_successful_at timestamptz,
    next_attempt_at timestamptz,
    last_error text
  );
select extensions.dblink_exec('h2_budget_second', 'rollback');

select is(
  (
    select count(*)
    from private.brochure_scan_budget_events
    where user_id in (
      '94000000-0000-4000-8000-000000000001',
      '94000000-0000-4000-8000-000000000002',
      '94000000-0000-4000-8000-000000000003'
    )
  ),
  25::bigint,
  'parallel requests cannot commit a twenty-sixth global budget event'
);
select is(
  (
    select count(*)
    from private.brochure_scan_budget_events
    where user_id = '94000000-0000-4000-8000-000000000002'
  ),
  1::bigint,
  'the admitted request consumes exactly one account event'
);
select is(
  (
    select count(*)
    from private.brochure_scan_budget_events
    where user_id = '94000000-0000-4000-8000-000000000003'
  ),
  0::bigint,
  'the rejected parallel request consumes no account event'
);
select is(
  (select count(*) from public.brochure_zip_scans where zip_code = '01307'),
  1::bigint,
  'the admitted parallel request creates its queue row'
);
select is(
  (select count(*) from public.brochure_zip_scans where zip_code = '01309'),
  0::bigint,
  'the rejected parallel request creates no queue row'
);
select is(
  (
    select count(*)
    from net.http_request_queue
    where convert_from(body, 'UTF8')::jsonb -> 'record' ->> 'zip_code' = '01309'
  ),
  0::bigint,
  'the rejected parallel request creates no webhook request'
);

select extensions.dblink_exec(
  'h2_budget_first',
  $cleanup$
    delete from net.http_request_queue
    where convert_from(body, 'UTF8')::jsonb -> 'record' ->> 'zip_code' in ('01307', '01309');
    delete from public.brochure_zip_scans where zip_code in ('01307', '01309');
    delete from auth.users
    where id in (
      '94000000-0000-4000-8000-000000000001',
      '94000000-0000-4000-8000-000000000002',
      '94000000-0000-4000-8000-000000000003'
    );
  $cleanup$
);
select is(
  pg_catalog.jsonb_build_object(
    'users', (
      select count(*)
      from auth.users
      where id in (
        '94000000-0000-4000-8000-000000000001',
        '94000000-0000-4000-8000-000000000002',
        '94000000-0000-4000-8000-000000000003'
      )
    ),
    'events', (
      select count(*)
      from private.brochure_scan_budget_events
      where user_id in (
        '94000000-0000-4000-8000-000000000001',
        '94000000-0000-4000-8000-000000000002',
        '94000000-0000-4000-8000-000000000003'
      )
    ),
    'scans', (
      select count(*)
      from public.brochure_zip_scans
      where zip_code in ('01307', '01309')
    ),
    'http_requests', (
      select count(*)
      from net.http_request_queue
      where convert_from(body, 'UTF8')::jsonb -> 'record' ->> 'zip_code' in ('01307', '01309')
    )
  ),
  '{"users": 0, "events": 0, "scans": 0, "http_requests": 0}'::jsonb,
  'parallel test fixtures are removed from the shared local database'
);
select extensions.dblink_disconnect('h2_budget_second');
select extensions.dblink_disconnect('h2_budget_first');

select * from finish();
rollback;
