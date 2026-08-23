-- Haushaltsweite Kategoriepraeferenzen fuer Issue #223 / Paket 2 (#225).

begin;
\ir helpers.sql

select plan(14);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob@example.com');
select tests.create_user('33333333-3333-3333-3333-333333333333', 'carol@example.com');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Familie Tozzi') as alice_hid \gset

select tests.authenticate_as('33333333-3333-3333-3333-333333333333');
select public.create_household('Familie Rossi') as carol_hid \gset

select tests.as_postgres();
insert into public.household_members (household_id, user_id, role)
values (:'alice_hid', '22222222-2222-2222-2222-222222222222', 'member');

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
insert into public.shopping_category_preferences (
  id,
  household_id,
  key_type,
  normalized_key_value,
  category_id,
  created_by
)
values (
  'aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa',
  :'alice_hid',
  'name',
  'vollmilch',
  'dairy',
  '11111111-1111-1111-1111-111111111111'
);

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
select is(
  (select category_id from public.shopping_category_preferences
   where id = 'aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa'),
  'dairy',
  'ein Haushaltsmitglied liest die gemeinsame Praeferenz'
);

update public.shopping_category_preferences
set category_id = 'beverages'
where id = 'aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa';

select is(
  (select category_id from public.shopping_category_preferences
   where id = 'aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa'),
  'beverages',
  'ein Haushaltsmitglied aktualisiert die gemeinsame Praeferenz'
);

select tests.authenticate_as('33333333-3333-3333-3333-333333333333');
select is(
  (select count(*)::int from public.shopping_category_preferences
   where household_id = :'alice_hid'),
  0,
  'ein Nichtmitglied sieht fremde Praeferenzen nicht'
);

select throws_ok(
  format(
    $$ insert into public.shopping_category_preferences
         (id, household_id, key_type, normalized_key_value, category_id, created_by)
       values
         ('bbbbbbbb-bbbb-5bbb-8bbb-bbbbbbbbbbbb', %L, 'name', 'apfelsaft', 'beverages',
          '33333333-3333-3333-3333-333333333333') $$,
    :'alice_hid'
  ),
  '42501',
  'new row violates row-level security policy for table "shopping_category_preferences"',
  'ein Nichtmitglied kann keine Praeferenz einschleusen'
);

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
select throws_ok(
  format(
    $$ update public.shopping_category_preferences
       set household_id = %L
       where id = 'aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa' $$,
    :'carol_hid'
  ),
  '42501',
  'new row violates row-level security policy for table "shopping_category_preferences"',
  'ein Mitglied kann eine Praeferenz nicht in einen fremden Haushalt verschieben'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  format(
    $$ insert into public.shopping_category_preferences
         (id, household_id, key_type, normalized_key_value, category_id, created_by)
       values
         ('cccccccc-cccc-5ccc-8ccc-cccccccccccc', %L, 'barcode', '4001234567890', 'dairy',
          '11111111-1111-1111-1111-111111111111') $$,
    :'alice_hid'
  ),
  '23514',
  null,
  'nur product und name sind gueltige Schluesseltypen'
);

select throws_ok(
  format(
    $$ insert into public.shopping_category_preferences
         (id, household_id, key_type, normalized_key_value, category_id, created_by)
       values
         ('dddddddd-dddd-5ddd-8ddd-dddddddddddd', %L, 'name', '', 'dairy',
          '11111111-1111-1111-1111-111111111111') $$,
    :'alice_hid'
  ),
  '23514',
  null,
  'ein Preference-Key darf nicht leer sein'
);

select throws_ok(
  format(
    $$ insert into public.shopping_category_preferences
         (household_id, key_type, normalized_key_value, category_id, created_by)
       values
         (%L, 'product', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'dairy',
          '11111111-1111-1111-1111-111111111111') $$,
    :'alice_hid'
  ),
  '23502',
  'null value in column "id" of relation "shopping_category_preferences" violates not-null constraint',
  'die deterministische Preference-ID muss vom Client geliefert werden'
);

select throws_ok(
  format(
    $$ insert into public.shopping_category_preferences
         (id, household_id, key_type, normalized_key_value, category_id, created_by)
       values
         ('ffffffff-ffff-5fff-8fff-ffffffffffff', %L, 'name', 'unbekannt', 'invalid',
          '11111111-1111-1111-1111-111111111111') $$,
    :'alice_hid'
  ),
  '23514',
  null,
  'unbekannte Kategorie-IDs werden abgelehnt'
);

update public.shopping_category_preferences
set deleted_at = now()
where id = 'aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa';

select throws_ok(
  format(
    $$ insert into public.shopping_category_preferences
         (id, household_id, key_type, normalized_key_value, category_id, created_by)
       values
         ('99999999-9999-5999-8999-999999999999', %L, 'name', 'vollmilch', 'dairy',
          '11111111-1111-1111-1111-111111111111') $$,
    :'alice_hid'
  ),
  '23505',
  null,
  'die natuerliche Identitaet bleibt auch nach Soft Delete eindeutig'
);

update public.shopping_category_preferences
set category_id = null, deleted_at = null
where id = 'aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa';

select is(
  (select category_id from public.shopping_category_preferences
   where id = 'aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa'),
  null,
  'Restore derselben Zeile erlaubt eine bewusste Sonstiges-Praeferenz'
);

select isnt(
  (select updated_at from public.shopping_category_preferences
   where id = 'aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa'),
  '-infinity'::timestamptz,
  'updated_at wird serverseitig gepflegt'
);

select tests.as_postgres();
select ok(
  has_table_privilege('authenticated', 'public.shopping_category_preferences', 'select,insert,update'),
  'authenticated hat die explizit benoetigten Data-API-Rechte'
);

select ok(
  not has_table_privilege('anon', 'public.shopping_category_preferences', 'select'),
  'anon hat keinen Tabellenzugriff auf Haushalts-Praeferenzen'
);

select * from finish();
rollback;
