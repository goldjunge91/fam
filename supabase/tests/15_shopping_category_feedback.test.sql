-- Push-only Datenschutz- und Vertragspruefung fuer Alpha-Feedback.

begin;
\ir helpers.sql

select plan(9);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice-feedback@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob-feedback@example.com');
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select public.create_household('Feedback Haushalt') as household_id \gset

select tests.as_postgres();
insert into public.stores (household_id, name, color)
values (:'household_id', 'Markt', '#123456')
returning id as store_id \gset

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
insert into public.shopping_category_feedback_events (
  event_id, schema_version, taxonomy_version, event_type, input_method,
  household_id, actor_user_id, shopping_list_item_id, product_key_type,
  product_key, barcode, product_name, store_id, preference_scope,
  old_placement_zone, new_placement_zone, predicted_placement_zone,
  old_category_source, new_category_source, predicted_product_family,
  predicted_product_form, classifier_version, platform, app_version,
  build_channel, client_created_at
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, 'placement-taxonomy-v2',
  'manual_reassign', 'edit_form', :'household_id',
  '11111111-1111-1111-1111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'barcode', '4001234567890',
  '4001234567890', 'Haferdrink', :'store_id', 'store', 'ambient_milk_drinks',
  'chilled_plant_based', 'ambient_milk_drinks', 'name_fallback',
  'store_preference', 'plant_drink', 'ambient', 'placement-v2.0.0', 'ios',
  '1.0.0', 'test', now()
);

select tests.as_postgres();
select is(
  (select count(*)::int from public.shopping_category_feedback_events
   where event_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1,
  'ein Haushaltsmitglied kann Feedback pushen'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ select count(*) from public.shopping_category_feedback_events $$,
  '42501',
  'permission denied for table shopping_category_feedback_events',
  'authenticated kann Feedback nicht lesen'
);

select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
select throws_ok(
  format(
    $$ insert into public.shopping_category_feedback_events
       (event_id, schema_version, taxonomy_version, event_type, input_method,
        household_id, actor_user_id, shopping_list_item_id, product_key_type,
        product_key, product_name, preference_scope, old_placement_zone,
        new_placement_zone, predicted_placement_zone, old_category_source,
        new_category_source, predicted_product_family, predicted_product_form,
        classifier_version, platform, app_version, build_channel, client_created_at)
       values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 1, 'placement-taxonomy-v2',
        'reset_to_automatic', 'edit_form', %L,
        '11111111-1111-1111-1111-111111111111',
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'name', 'milch', 'Milch',
        'household', 'chilled_dairy_eggs', 'chilled_dairy_eggs',
        'chilled_dairy_eggs', 'user', 'household_preference', 'milk', 'chilled',
        'placement-v2.0.0', 'ios', '1.0.0', 'test', now()) $$,
    :'household_id'
  ),
  '42501',
  null,
  'fremder Actor kann kein Feedback einschleusen'
);

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select tests.as_postgres();
select throws_ok(
  $$ insert into public.shopping_category_feedback_events
     (event_id, schema_version, taxonomy_version, event_type, input_method,
      household_id, actor_user_id, shopping_list_item_id, product_key_type,
      product_key, product_name, preference_scope, old_placement_zone,
      new_placement_zone, predicted_placement_zone, old_category_source,
      new_category_source, predicted_product_family, predicted_product_form,
      classifier_version, platform, app_version, build_channel, client_created_at)
     values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 1, 'placement-taxonomy-v2',
      'manual_reassign', 'edit_form', '00000000-0000-0000-0000-000000000000',
      '11111111-1111-1111-1111-111111111111',
      'ffffffff-ffff-4fff-8fff-ffffffffffff', 'name', 'milch', 'Milch',
      'household', 'bakery', 'chilled_dairy_eggs', 'bakery', 'user', 'user', 'milk', 'chilled',
      'placement-v2.0.0', 'ios', '1.0.0', 'test', now()) $$,
  '23503', null, 'Feedback verlangt einen existierenden Haushalt'
);

select throws_ok(
  format(
    $$ insert into public.shopping_category_feedback_events
       (event_id, schema_version, taxonomy_version, event_type, input_method,
        household_id, actor_user_id, shopping_list_item_id, product_key_type,
        product_key, barcode, product_name, preference_scope, old_placement_zone,
        new_placement_zone, predicted_placement_zone, old_category_source,
        new_category_source, predicted_product_family, predicted_product_form,
        classifier_version, platform, app_version, build_channel, client_created_at)
       values ('99999999-9999-4999-8999-999999999999', 1, 'placement-taxonomy-v2',
        'manual_reassign', 'edit_form', %L,
        '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-bbbb-4aaa-8aaa-aaaaaaaaaaaa', 'barcode', '12', '12', 'Milch',
        'household', 'bakery', 'dairy', 'bakery', 'user', 'user', 'milk', 'chilled',
        'placement-v2.0.0', 'ios', '1.0.0', 'test', now()) $$,
    :'household_id'
  ),
  '23514', null, 'Barcodes ausserhalb des Vertrags werden abgelehnt'
);

select tests.as_postgres();
select ok(
  has_table_privilege('authenticated', 'public.shopping_category_feedback_events', 'insert'),
  'authenticated hat nur das erforderliche Insert-Recht'
);
select ok(
  not has_table_privilege('authenticated', 'public.shopping_category_feedback_events', 'select'),
  'authenticated hat kein Select-Recht'
);
select ok(
  has_table_privilege('service_role', 'public.shopping_category_feedback_events', 'select'),
  'service_role kann fuer den manuellen Import lesen'
);
select ok(
  not has_table_privilege('service_role', 'public.shopping_category_feedback_events', 'update,delete'),
  'service_role hat keine Update-/Delete-Rechte'
);

select * from finish();
rollback;
