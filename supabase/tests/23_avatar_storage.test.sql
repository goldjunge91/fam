-- Behavior tests for private avatars. All fixtures are rolled back.
begin;
\ir helpers.sql
select plan(10);
select is((select public::text from storage.buckets where id = 'avatars'), 'false', 'avatars bucket is private');
select tests.create_user('a1000000-0000-4000-8000-000000000001', 'avatar-owner@example.test');
select tests.create_user('a1000000-0000-4000-8000-000000000002', 'avatar-member@example.test');
select tests.create_user('a1000000-0000-4000-8000-000000000003', 'avatar-stranger@example.test');
insert into public.households (id, name, created_by)
values ('b1000000-0000-4000-8000-000000000001', 'Avatar test', 'a1000000-0000-4000-8000-000000000001');
insert into public.household_members (household_id, user_id, role)
values ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'admin'),
       ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'member')
on conflict do nothing;
select tests.authenticate_as('a1000000-0000-4000-8000-000000000001');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('avatars', 'a1000000-0000-4000-8000-000000000001/avatar.jpg')$$, 'owner can upload');
select is((select count(*) from storage.objects where bucket_id='avatars' and name='a1000000-0000-4000-8000-000000000001/avatar.jpg'), 1::bigint, 'owner can read');
select tests.authenticate_as('a1000000-0000-4000-8000-000000000002');
select is((select count(*) from storage.objects where bucket_id='avatars' and name='a1000000-0000-4000-8000-000000000001/avatar.jpg'), 1::bigint, 'household member can read');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('avatars', 'a1000000-0000-4000-8000-000000000001/other.jpg')$$, '42501', null, 'member cannot write owner folder');
select is((with changed as (update storage.objects set metadata='{}' where bucket_id='avatars' and name='a1000000-0000-4000-8000-000000000001/avatar.jpg' returning id) select count(*) from changed), 0::bigint, 'member cannot overwrite');
select is((with removed as (delete from storage.objects where bucket_id='avatars' and name='a1000000-0000-4000-8000-000000000001/avatar.jpg' returning id) select count(*) from removed), 0::bigint, 'member cannot delete');
select tests.authenticate_as('a1000000-0000-4000-8000-000000000003');
select is((select count(*) from storage.objects where bucket_id='avatars' and name='a1000000-0000-4000-8000-000000000001/avatar.jpg'), 0::bigint, 'stranger cannot read');
select tests.authenticate_as_anon();
select is((select count(*) from storage.objects where bucket_id='avatars' and name='a1000000-0000-4000-8000-000000000001/avatar.jpg'), 0::bigint, 'anonymous cannot read');
select tests.as_postgres();
delete from public.household_members where household_id='b1000000-0000-4000-8000-000000000001' and user_id='a1000000-0000-4000-8000-000000000002';
select tests.authenticate_as('a1000000-0000-4000-8000-000000000002');
select is((select count(*) from storage.objects where bucket_id='avatars' and name='a1000000-0000-4000-8000-000000000001/avatar.jpg'), 0::bigint, 'former member cannot read');
select * from finish();
rollback;
