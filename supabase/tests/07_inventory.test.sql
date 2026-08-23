-- storage_locations, fridge_items, shopping_list_items (#39, #40, #43).

begin;
\ir helpers.sql

select plan(18);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol@example.com');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Familie Tozzi') as hid \gset

-- Neue Haushalte brauchen sofort nutzbare Standardorte.
select is(
  (select count(*)::int from public.storage_locations),
  3,
  'create_household legt Kuehlschrank, Gefrierfach und Vorratsschrank an'
);

select set_eq(
  $$ select kind from public.storage_locations $$,
  $$ values ('fridge'),('freezer'),('pantry') $$,
  'die drei Standard-Lagerorte haben die erwarteten Typen'
);

select is(
  (select count(*)::int from public.stores),
  3,
  'create_household legt REWE, Edeka und Aldi als Standard-Supermaerkte an'
);

select set_eq(
  $$ select name from public.stores $$,
  $$ values ('REWE'),('Edeka'),('Aldi') $$,
  'die drei Standard-Supermaerkte haben die erwarteten Namen'
);

select set_eq(
  $$ select color from public.stores $$,
  $$ values ('#B5623F'),('#748C5B'),('#5C7396') $$,
  'die drei Standard-Supermaerkte haben die erwarteten Farben'
);

select throws_ok(
  format(
    $$ insert into public.stores (household_id, name, color)
       values (%L, 'rewe', '#B5623F') $$,
    :'hid'
  ),
  '23505',
  null,
  'Duplikate von Supermarkt-Namen im selben Haushalt werden abgelehnt'
);

select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values (:'hid', '22222222-2222-2222-2222-222222222222', 'member');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
insert into public.fridge_items (household_id, location_id, name, quantity, unit, expiry_date, added_by)
select :'hid', id, 'Milch', 1, 'l', current_date + 3, '11111111-1111-1111-1111-111111111111'
from public.storage_locations where kind = 'fridge';

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');

select is(
  (select count(*)::int from public.fridge_items),
  1,
  'ein anderes Mitglied sieht den Bestand'
);

update public.fridge_items set quantity = 0.5 where name = 'Milch';

select is(
  (select quantity from public.fridge_items where name = 'Milch'),
  0.5::numeric(10,3),
  'jedes Mitglied darf den geteilten Bestand aendern'
);

select tests.authenticate_as('33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.fridge_items),
  0,
  'Aussenstehende sehen fremden Bestand nicht'
);

select is(
  (select count(*)::int from public.storage_locations),
  0,
  'Aussenstehende sehen fremde Lagerorte nicht'
);

select is(
  (select count(*)::int from public.stores),
  0,
  'Aussenstehende sehen fremde Supermaerkte nicht'
);

-- RLS-INSERTs schlagen fehl; UPDATE und DELETE unsichtbarer Zeilen treffen nur 0 Zeilen.
select throws_ok(
  format(
    $$ insert into public.fridge_items (household_id, name, added_by)
       values (%L, 'eingeschleust', '33333333-3333-3333-3333-333333333333') $$,
    :'hid'
  ),
  '42501',
  'new row violates row-level security policy for table "fridge_items"',
  'Aussenstehende koennen nichts in fremde Haushalte einschleusen'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
insert into public.shopping_list_items (household_id, name, quantity, unit, added_by)
values (:'hid', 'Haferflocken', 2, 'package', '11111111-1111-1111-1111-111111111111');

select is(
  (select checked_at from public.shopping_list_items),
  null,
  'ein neuer Eintrag ist nicht abgehakt'
);

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
update public.shopping_list_items
set checked_at = now(), checked_by = '22222222-2222-2222-2222-222222222222';

select isnt(
  (select checked_at from public.shopping_list_items),
  null,
  'ein anderes Mitglied kann abhaken'
);

select is(
  (select checked_by from public.shopping_list_items),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'checked_by haelt fest, wer abgehakt hat'
);

-- Tombstones machen Loeschungen fuer Offline-Clients sichtbar.
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
update public.fridge_items set deleted_at = now() where name = 'Milch';

select is(
  (select count(*)::int from public.fridge_items where deleted_at is not null),
  1,
  'Entfernen setzt deleted_at, statt die Zeile zu loeschen'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
insert into public.shopping_history (household_id, completed_by, completed_at, item_name, quantity, unit, location_kind)
values (:'hid', '11111111-1111-1111-1111-111111111111', now(), 'Vollmilch', 2, 'l', 'fridge');

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
select is(
  (select count(*)::int from public.shopping_history),
  1,
  'Haushaltsmitglieder koennen die Einkaufshistorie lesen'
);

select tests.authenticate_as('33333333-3333-3333-3333-333333333333');
select is(
  (select count(*)::int from public.shopping_history),
  0,
  'Aussenstehende sehen fremde Einkaufshistorie nicht'
);

select * from finish();
rollback;
