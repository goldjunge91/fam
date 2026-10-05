-- household_invites + redeem_invite (#36, #43).

begin;
\ir helpers.sql

select plan(13);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');

select tests.as_postgres();
select ok(
  (select relrowsecurity from pg_class where oid = 'private.household_invite_attempts'::regclass),
  'Fehlversuche sind durch RLS geschuetzt'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'private'
      and tablename = 'household_invite_attempts'
      and policyname = 'household_invite_attempts_deny_direct_access'
  ),
  'Fehlversuche haben eine explizite Sperr-Policy'
);
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol@example.com');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Familie Tozzi') as hid \gset

-- Einladung mit genau einer Nutzung.
insert into public.household_invites (household_id, created_by, max_uses)
values (:'hid', '11111111-1111-1111-1111-111111111111', 1);

select is(
  (select count(*)::int from public.household_invites),
  1,
  'ein Administrator kann eine Einladung anlegen'
);

-- Den Token holt sich der Test als Superuser. In der App kommt er aus dem
-- Einladungslink — nie aus einer Query, denn genau das verhindert die Policy.
select tests.as_postgres();
select token as tok, code as code from public.household_invites \gset
select matches(:'code'::text, '^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$', 'Einladungen erhalten einen sechsstelligen gut lesbaren Code');

-- ------------------------------------------------- Nichtmitglied sieht nichts
select tests.authenticate_as('22222222-2222-2222-2222-222222222222');

select is(
  (select count(*)::int from public.household_invites),
  0,
  'ein Nichtmitglied sieht keine Einladungen'
);

-- ------------------------------------------------------------------ Beitritt
select isnt(
  public.redeem_invite(:'code'),
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

-- ------------------------------------------------------------- Doppelklick
-- Ein zweiter Klick auf denselben Link darf weder fehlschlagen noch eine
-- Nutzung verbrauchen — sonst brennt ein Nutzer die Einladung fuer jemand
-- anderen ab.
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

-- --------------------------------------------------------------- aufgebraucht
select tests.authenticate_as('33333333-3333-3333-3333-333333333333');
select throws_ok(
  format('select public.redeem_invite(%L::uuid)', :'tok'),
  'P0001',
  'Einladung ist aufgebraucht',
  'nach max_uses weist die Einladung weitere Beitritte ab'
);

-- Falsche Codes duerfen nicht unbegrenzt durchprobiert werden.
select tests.as_postgres();
select tests.create_user('44444444-4444-4444-4444-444444444444', 'dave@example.com');
select tests.authenticate_as('44444444-4444-4444-4444-444444444444');
do $$
begin
  for attempt in 1..10 loop
    begin
      perform public.redeem_invite('!!!!!!');
    exception when others then
      null;
    end;
  end loop;
end;
$$;
select is(
  public.redeem_invite('!!!!!!'),
  null,
  'Einladungscodes sind auf zehn Versuche pro Fuenf-Minuten-Fenster begrenzt'
);

-- ------------------------------------------------------------------ abgelaufen
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
