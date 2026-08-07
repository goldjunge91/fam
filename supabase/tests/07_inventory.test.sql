-- storage_locations, fridge_items, shopping_list_items (#39, #40, #43).

begin;
\ir helpers.sql

select plan(13);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol@example.com');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Familie Tozzi') as hid \gset

-- ------------------------------------------------------- Standard-Lagerorte
-- Ein Haushalt ohne Lagerorte waere eine Sackgasse: Der Nutzer koennte nichts
-- erfassen und muesste erst selbst herausfinden, dass ihm etwas fehlt.
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

select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values (:'hid', '22222222-2222-2222-2222-222222222222', 'member');

-- ------------------------------------------------------- geteilt im Haushalt
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
insert into public.fridge_items (household_id, location_id, name, quantity, unit, expiry_date, added_by)
select :'hid', id, 'Milch', 1, 'l', current_date + 3, '11111111-1111-1111-1111-111111111111'
from public.storage_locations where kind = 'fridge';

-- Bob sieht und aendert, was Alice erfasst hat — das ist der Zweck des Features.
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

-- ------------------------------------------------------------- Aussenstehende
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

-- Bei INSERT wirft RLS einen Fehler, statt still zu filtern — anders als bei
-- UPDATE und DELETE, wo eine nicht sichtbare Zeile einfach 0 Treffer ergibt.
-- Das ist das deutlichere Verhalten: Der Client bekommt eine Absage statt eines
-- scheinbaren Erfolgs.
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

-- ------------------------------------------------------------ Einkaufsliste
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
insert into public.shopping_list_items (household_id, name, quantity, unit, added_by)
values (:'hid', 'Haferflocken', 2, 'package', '11111111-1111-1111-1111-111111111111');

select is(
  (select checked_at from public.shopping_list_items),
  null,
  'ein neuer Eintrag ist nicht abgehakt'
);

-- checked_at als Zeitstempel statt Boolean: So bleibt beim Einkaufsabschluss
-- rekonstruierbar, was zu diesem Einkauf gehoerte.
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

-- --------------------------------------------------------------- Soft-Delete
-- Harte Deletes sind fuer Offline-Sync unbrauchbar: Ein Client, der waehrend
-- des Loeschens offline war, koennte "geloescht" nicht von "noch nie gesehen"
-- unterscheiden und wuerde die Zeile beim naechsten Push wieder anlegen.
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
update public.fridge_items set deleted_at = now() where name = 'Milch';

select is(
  (select count(*)::int from public.fridge_items where deleted_at is not null),
  1,
  'Entfernen setzt deleted_at, statt die Zeile zu loeschen'
);

-- ----------------------------------------------------------- Einkaufshistorie
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

