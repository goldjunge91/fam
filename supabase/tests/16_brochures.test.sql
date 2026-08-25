begin;
\ir helpers.sql

select plan(11);

-- 1. Setup Test Users
select tests.create_user('b188c0a3-fdbf-47cf-8980-0a2c0064d3ff', 'test@example.com');
select tests.create_user('a718c0a3-fdbf-47cf-8980-0a2c0064d3aa', 'other@example.com');

-- 2. Insert Base Data (as postgres)
select tests.as_postgres();
insert into public.brochure_stores (id, name, logo_url) values ('test_store', 'Test Store', 'url');
insert into public.brochure_dumps (zip_code, payload_json, valid_from, valid_until) 
values ('99999', '{"foo": "bar"}'::jsonb, now(), now() + interval '7 days');

-- 3. Test Global Tables (Read Only)
select tests.authenticate_as('b188c0a3-fdbf-47cf-8980-0a2c0064d3ff');

select results_eq(
  'select id from public.brochure_stores where id = ''test_store''',
  $$values ('test_store'::text)$$,
  'Authenticated users can read brochure_stores'
);

select results_eq(
  'select zip_code from public.brochure_dumps where zip_code = ''99999''',
  $$values ('99999'::text)$$,
  'Authenticated users can read brochure_dumps'
);

select throws_ok(
  'insert into public.brochure_stores (id, name) values (''aldi_new'', ''Aldi New'')',
  '42501',
  null,
  'Authenticated users CANNOT insert into brochure_stores'
);

select throws_ok(
  'insert into public.brochure_dumps (zip_code, payload_json, valid_from, valid_until) values (''12345'', ''{}''::jsonb, now(), now())',
  '42501',
  null,
  'Authenticated users CANNOT insert into brochure_dumps'
);

-- 4. Test Private Table (favorite_brochure_stores)
-- Test user creates a favorite
select lives_ok(
  $$insert into public.favorite_brochure_stores (user_id, store_id) values ('b188c0a3-fdbf-47cf-8980-0a2c0064d3ff'::uuid, 'test_store')$$,
  'User can favorite a store for themselves'
);

-- Test user tries to create for someone else
select throws_ok(
  $$insert into public.favorite_brochure_stores (user_id, store_id) values ('a718c0a3-fdbf-47cf-8980-0a2c0064d3aa'::uuid, 'test_store')$$,
  '42501',
  null,
  'User CANNOT favorite a store for another user'
);

-- Visibility check
select is(
  (select count(*) from public.favorite_brochure_stores where store_id = 'test_store'),
  1::bigint,
  'User sees only their own favorite stores'
);

-- Switch to other user
select tests.authenticate_as('a718c0a3-fdbf-47cf-8980-0a2c0064d3aa');

select is(
  (select count(*) from public.favorite_brochure_stores where store_id = 'test_store'),
  0::bigint,
  'Other user cannot see first user''s favorites'
);

-- Other user creates favorite
select lives_ok(
  $$insert into public.favorite_brochure_stores (user_id, store_id) values ('a718c0a3-fdbf-47cf-8980-0a2c0064d3aa'::uuid, 'test_store')$$,
  'Other user can favorite the same store'
);

-- Update check
select tests.authenticate_as('b188c0a3-fdbf-47cf-8980-0a2c0064d3ff');
select lives_ok(
  $$update public.favorite_brochure_stores set deleted_at = now() where store_id = 'test_store'$$,
  'User can update their own favorite'
);

select is(
  (select deleted_at is null from public.favorite_brochure_stores where store_id = 'test_store' and user_id = 'a718c0a3-fdbf-47cf-8980-0a2c0064d3aa'::uuid),
  null,
  'Other users favorite remains untouched'
);

select * from finish();
rollback;
