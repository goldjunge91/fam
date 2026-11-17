-- Der PostHog-Checkpoint bleibt serverseitig und wird mit dem Auth-Account geloescht.

begin;
\ir helpers.sql

select plan(11);

select ok(
  (select relrowsecurity
   from pg_class
   where oid = 'public.account_deletion_requests'::regclass),
  'account_deletion_requests hat RLS'
);

select ok(
  not has_table_privilege('anon', 'public.account_deletion_requests', 'select,insert,update,delete'),
  'anon hat keine Rechte auf den Loesch-Checkpoint'
);
select ok(
  not has_table_privilege('authenticated', 'public.account_deletion_requests', 'select,insert,update,delete'),
  'authenticated hat keine Rechte auf den Loesch-Checkpoint'
);
select ok(
  has_table_privilege('service_role', 'public.account_deletion_requests', 'select,insert,update,delete'),
  'service_role hat die benoetigten Checkpoint-Rechte'
);
select ok(
  (select array_agg(role_name order by role_name) = array['service_role']::text[]
   from (
     select r.rolname::text as role_name
     from pg_roles r
     join pg_policy p on r.oid = any(p.polroles)
     where p.polrelid = 'public.account_deletion_requests'::regclass
       and p.polname = 'account_deletion_requests_service_role_all'
   ) as policy_roles),
  'nur service_role hat eine Checkpoint-Policy'
);

select tests.create_user(
  '44444444-4444-4444-4444-444444444444',
  'deletion-checkpoint@example.invalid'
);

set local role service_role;
select lives_ok(
  $$ insert into public.account_deletion_requests (
       user_id,
       posthog_person_ids,
       delete_requested_at
     ) values (
       '44444444-4444-4444-4444-444444444444',
       array['posthog-person-redacted'],
       '2026-01-01T00:00:00Z'::timestamptz
     ) $$,
  'service_role kann einen Checkpoint anlegen'
);
select lives_ok(
  $$ update public.account_deletion_requests
     set delete_accepted_at = '2026-01-01T00:01:00Z'::timestamptz
     where user_id = '44444444-4444-4444-4444-444444444444' $$,
  'service_role kann die Annahme idempotent fortschreiben'
);
select ok(
  (select delete_accepted_at = '2026-01-01T00:01:00Z'::timestamptz
      and updated_at is not null
   from public.account_deletion_requests
   where user_id = '44444444-4444-4444-4444-444444444444'),
  'der Checkpoint enthaelt Annahme und Aktualisierungszeitpunkt'
);
select lives_ok(
  $$ delete from public.account_deletion_requests
     where user_id = '44444444-4444-4444-4444-444444444444' $$,
  'service_role kann einen Checkpoint wiederholen und entfernen'
);
reset role;

select tests.authenticate_as('44444444-4444-4444-4444-444444444444');
select throws_ok(
  $$ select * from public.account_deletion_requests $$,
  '42501',
  null,
  'authenticated kann den Checkpoint nicht lesen'
);
select tests.as_postgres();

set local role service_role;
insert into public.account_deletion_requests (
  user_id,
  posthog_person_ids,
  delete_requested_at,
  delete_accepted_at
) values (
  '44444444-4444-4444-4444-444444444444',
  array['posthog-person-redacted'],
  '2026-01-01T00:00:00Z'::timestamptz,
  '2026-01-01T00:01:00Z'::timestamptz
);
reset role;

select tests.as_postgres();
delete from auth.users where id = '44444444-4444-4444-4444-444444444444';
select is(
  (select count(*) from public.account_deletion_requests
   where user_id = '44444444-4444-4444-4444-444444444444'),
  0::bigint,
  'das Loeschen des Auth-Accounts entfernt den Checkpoint per Cascade'
);

select * from finish();
rollback;
