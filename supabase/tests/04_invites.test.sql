-- household_invites + redeem_invite (#36, #43).

begin;
\ir helpers.sql

select plan(9);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol@example.com');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Familie Tozzi') as hid \gset

insert into public.household_invites (household_id, created_by, max_uses)
values (:'hid', '11111111-1111-1111-1111-111111111111', 1);

select is(
  (select count(*)::int from public.household_invites),
  1,
  'ein Administrator kann eine Einladung anlegen'
);

-- Nur der Test-Superuser liest den sonst ausschliesslich per Link verteilten Token.
select tests.as_postgres();
select token as tok from public.household_invites \gset

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');

select is(
  (select count(*)::int from public.household_invites),
  0,
  'ein Nichtmitglied sieht keine Einladungen'
);

select isnt(
  public.redeem_invite(:'tok'::uuid),
  null,
  'Bob kann die Einladung einloesen, obwohl er den Haushalt nicht sehen kann'
);

select tests.as_postgres();
select is(
  (select count(*)::int from public.household_members where household_id = :'hid'),
  2,
  'Bob ist jetzt Mitglied'
);

select is(
  (select role from public.household_members
   where user_id = '22222222-2222-2222-2222-222222222222'),
  'member',
  'ein Beitretender wird Mitglied, nicht Administrator'
);

-- Wiederholte Einloesung muss idempotent bleiben.
select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
select lives_ok(
  format('select public.redeem_invite(%L::uuid)', :'tok'),
  'eine zweite Einloesung durch dasselbe Mitglied schlaegt nicht fehl'
);

select tests.as_postgres();
select is(
  (select uses::int from public.household_invites),
  1,
  'der Doppelklick hat keine zweite Nutzung verbraucht'
);

select tests.authenticate_as('33333333-3333-3333-3333-333333333333');
select throws_ok(
  format('select public.redeem_invite(%L::uuid)', :'tok'),
  'P0001',
  'Einladung ist aufgebraucht',
  'nach max_uses weist die Einladung weitere Beitritte ab'
);

select tests.as_postgres();
update public.household_invites
set expires_at = now() - interval '1 day', max_uses = 5;

select tests.authenticate_as('33333333-3333-3333-3333-333333333333');
select throws_ok(
  format('select public.redeem_invite(%L::uuid)', :'tok'),
  'P0001',
  'Einladung ist abgelaufen',
  'eine abgelaufene Einladung wird abgewiesen, auch wenn Nutzungen frei sind'
);

select tests.as_postgres();
select * from finish();
rollback;
