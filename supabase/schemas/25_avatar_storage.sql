-- Gewuenschter Endzustand — NICHT von Hand migrieren.
--
-- RLS fuer den Storage-Bucket `avatars` (Profilbilder). Der Bucket selbst
-- wird NICHT hier angelegt: `insert into storage.buckets` ist DML, kein DDL,
-- und wird vom Schema-Diff nicht erfasst (siehe Kommentar in
-- 12_recipe_storage.sql). Der Bucket steht stattdessen in `supabase/seed.sql`
-- (lokal) und muss auf dem verlinkten Projekt einmalig manuell angelegt
-- werden (public = true, damit getPublicUrl() ohne Signatur funktioniert).
--
-- ACHTUNG: `storage.objects` gehoert strukturell nie zum von `db diff`
-- verglichenen Objektbestand. Die Policies hier laufen zwar gegen die
-- Schatten-DB beim Diffen, landen aber in KEINER generierten Migration.
-- Verbindlich angewendet werden sie ueber die Ausnahme-Migration unter
-- `supabase/migrations/`. Aendert sich eine Policy, braucht sie dort eine
-- explizite Folgemigration.
--
-- Pfadkonvention: Profilbilder liegen unter `<user_id>/avatar.jpg`
-- (`src/features/profile/avatar-uploader.ts`). Lesen ist oeffentlich (Bucket
-- ist public), Schreiben/Loeschen ist auf den eigenen Ordner beschraenkt.

create policy avatars_select on storage.objects
  for select to public
  using (bucket_id = 'avatars');

create policy avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (select auth.uid()) = ((storage.foldername(name))[1])::uuid
  );

create policy avatars_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (select auth.uid()) = ((storage.foldername(name))[1])::uuid
  )
  with check (
    bucket_id = 'avatars'
    and (select auth.uid()) = ((storage.foldername(name))[1])::uuid
  );

create policy avatars_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (select auth.uid()) = ((storage.foldername(name))[1])::uuid
  );
