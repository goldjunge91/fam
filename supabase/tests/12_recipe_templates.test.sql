-- recipe_templates, recipe_template_components, recipe_template_items,
-- recipe_template_steps: global lesbar, read-only fuer Clients (#Recipe-Templates).

begin;
\ir helpers.sql

select plan(8);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice@example.com');

-- Fixture ausserhalb der authentifizierten Rolle anlegen (als postgres) —
-- Clients koennen ueber RLS ohnehin nicht in diese Tabellen schreiben, siehe
-- unten. Realistisch waeren das die Seed-Daten aus supabase/seed.sql.
select tests.as_postgres();

insert into public.recipe_templates (id, title, dish_types, default_servings)
values ('99999999-9999-9999-9999-999999999901', 'Test-Vorlage', array['lunch'], 2)
returning id as template_id \gset

insert into public.recipe_template_components (id, template_id, name)
values ('99999999-9999-9999-9999-999999999902', :'template_id', 'Zutaten')
returning id as component_id \gset

insert into public.products (id, name, kcal_per_100, source)
values ('99999999-9999-9999-9999-999999999903', 'Test-Zutat', 100, 'manual')
returning id as product_id \gset

insert into public.recipe_template_items (id, component_id, template_id, product_id, grams)
values ('99999999-9999-9999-9999-999999999904', :'component_id', :'template_id', :'product_id', 100)
returning id as item_id \gset

insert into public.recipe_template_steps (id, template_id, position, text)
values ('99999999-9999-9999-9999-999999999905', :'template_id', 0, 'Test-Schritt.');

-- ------------------------------------------------------------ global lesbar
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

select is(
  (select title from public.recipe_templates where id = :'template_id'),
  'Test-Vorlage',
  'authentifizierter Nutzer kann Vorlagen lesen'
);

select is(
  (select name from public.recipe_template_components where id = :'component_id'),
  'Zutaten',
  'authentifizierter Nutzer kann Vorlagen-Komponenten lesen'
);

select is(
  (select grams::int from public.recipe_template_items where id = :'item_id'),
  100,
  'authentifizierter Nutzer kann Vorlagen-Positionen lesen'
);

select is(
  (select text from public.recipe_template_steps where template_id = :'template_id'),
  'Test-Schritt.',
  'authentifizierter Nutzer kann Vorlagen-Schritte lesen'
);

-- --------------------------------------------------------------- read-only
select throws_ok(
  format($$ insert into public.recipe_templates (title) values ('Hack') $$),
  '42501',
  null,
  'Client kann keine Vorlage anlegen'
);

-- update/delete ohne passende Policy betreffen unter RLS schlicht null Zeilen
-- (kein Wurf) — anders als insert, das mangels with-check-Policy 42501 wirft.
update public.recipe_templates set title = 'Hack' where id = :'template_id';
delete from public.recipe_templates where id = :'template_id';

select tests.as_postgres();
select is(
  (select title from public.recipe_templates where id = :'template_id'),
  'Test-Vorlage',
  'Client kann eine Vorlage weder aendern noch loeschen'
);

-- ---------------------------------------------------- Konsistenz-Trigger
select throws_ok(
  format(
    $$ insert into public.recipe_template_items (component_id, template_id, sub_component_id, grams)
       values (%L, %L, %L, 50) $$,
    :'component_id', :'template_id', :'component_id'
  ),
  'P0001',
  'Eine Komponente kann sich nicht selbst als Unterkomponente enthalten',
  'Selbstbezug einer Komponente wird abgelehnt'
);

-- Zweite Komponente desselben Templates, um "product_id UND sub_component_id
-- gleichzeitig" ohne den vorrangigen Selbstbezugs-Check zu pruefen.
insert into public.recipe_template_components (id, template_id, name)
values ('99999999-9999-9999-9999-999999999906', :'template_id', 'Zweite Komponente');

select throws_ok(
  $$ insert into public.recipe_template_items (component_id, template_id, product_id, sub_component_id, grams)
     values ('99999999-9999-9999-9999-999999999902', '99999999-9999-9999-9999-999999999901', '99999999-9999-9999-9999-999999999903', '99999999-9999-9999-9999-999999999906', 50) $$,
  '23514',
  null,
  'Position mit Produkt UND Unterkomponente gleichzeitig wird abgelehnt'
);

select * from finish();
rollback;
