-- RLS-Policies fuer den Storage-Bucket `avatars` (siehe 25_avatar_storage.sql).

begin;
\ir helpers.sql

select plan(2);

-- storage.objects liegt ausserhalb dessen, was `db diff` erfasst (siehe
-- Kommentar in 25_avatar_storage.sql) — dieser Test schlaegt an, wenn die
-- Policies nach einem Reset/Push nicht manuell nachgezogen wurden.
select set_eq(
  $$ select policyname from pg_policies where tablename = 'objects' and policyname like 'avatars_%' $$,
  $$ values ('avatars_select'), ('avatars_insert'), ('avatars_update'), ('avatars_delete') $$,
  'RLS-Policies fuer den avatars-Bucket sind vorhanden (siehe 25_avatar_storage.sql)'
);

select ok(
  (
    select with_check
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatars_insert'
  ) like '%auth.uid()%',
  'Schreiben ist auf den eigenen Nutzer-Ordner beschraenkt'
);

select * from finish();
rollback;
