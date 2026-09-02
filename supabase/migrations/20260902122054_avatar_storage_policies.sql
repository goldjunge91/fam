-- Handgeschriebene Ausnahme vom "keine manuellen Migrationen"-Grundsatz aus
-- AGENTS.md: `storage.objects` ist ein von Supabase verwaltetes System-Schema
-- und wird von `db diff` nie erfasst (siehe Kommentar in
-- 20260812204337_recipe_storage_policies.sql).
--
-- Diese Migration ist die verbindliche, tatsaechlich angewendete Fassung der
-- Policies aus supabase/schemas/25_avatar_storage.sql (Bucket `avatars`).
-- Aendert sich die Policy-Definition, muss diese Migration von Hand
-- nachgezogen werden (drop + create).

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
