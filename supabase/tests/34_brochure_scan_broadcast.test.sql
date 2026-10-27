begin;
\ir helpers.sql

select plan(6);

select tests.as_postgres();
select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'brochure_scan_broadcast_receive'
      and roles = array['authenticated'::name]
      and qual like '%broadcast%'
      and qual like '%^brochure-scan:[0-9]{5}$%'
  ),
  'only authenticated clients can receive a well-formed PLZ broadcast topic'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'realtime.messages'::regclass),
  'Realtime message authorization remains enabled'
);
select is(
  (
    select count(*)
    from pg_trigger
    where tgrelid = 'public.brochure_zip_scans'::regclass
      and tgname in ('broadcast_brochure_zip_scan_insert', 'broadcast_brochure_zip_scan_update')
      and not tgisinternal
  ),
  2::bigint,
  'both terminal scan updates and terminal failure inserts publish notifications'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.broadcast_brochure_zip_scan_finished()',
    'execute'
  ),
  'app users cannot invoke the trigger function directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.brochure_zip_scans', 'select'),
  'app users still cannot read the global scan queue'
);

set local role service_role;
select lives_ok(
  $$select public.record_brochure_zip_scan_failure('87654', 'broadcast delivery test')$$,
  'a missing Realtime partition does not make scan failure recording fail'
);
reset role;

select * from finish();
rollback;
