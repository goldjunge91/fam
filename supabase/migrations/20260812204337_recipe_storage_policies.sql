-- Handgeschriebene Ausnahme vom "keine manuellen Migrationen"-Grundsatz aus
-- AGENTS.md: `storage.objects` ist ein von Supabase verwaltetes System-Schema
-- und wird von `db diff` (weder `migra` noch `pg-delta`) jemals erfasst, weil
-- die Diff-Engine nur die von uns selbst deklarierten Schemas vergleicht, nicht
-- Supabase-interne Namespaces wie `storage`, `auth`, `realtime`, `vault`. Ein
-- `create policy ... on storage.objects` in supabase/schemas/*.sql laeuft zwar
-- gegen die Shadow-DB, taucht aber nie in einer generierten Migration auf.
--
-- Diese Migration ist deshalb die verbindliche, tatsaechlich angewendete
-- Fassung der Policies aus:
--   - supabase/schemas/12_recipe_storage.sql   (Bucket recipe-covers)
--   - supabase/schemas/13_recipe_step_storage.sql (Bucket recipe-step-images)
--
-- Aendert sich eine der beiden Policy-Definitionen, muss diese Migration von
-- Hand nachgezogen werden (drop + create, siehe "alter policy" in AGENTS.md).
-- Die Schema-Dateien bleiben die lesbare Quelle des gewuenschten Endzustands;
-- diese Datei ist die einzige Moeglichkeit, ihn tatsaechlich in die DB zu
-- bekommen.

create policy recipe_covers_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'recipe-covers'
    and (select private.is_household_member(((storage.foldername(name))[1])::uuid))
  );

create policy recipe_covers_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'recipe-covers'
    and (select private.is_household_member(((storage.foldername(name))[1])::uuid))
  );

create policy recipe_covers_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'recipe-covers'
    and (select private.is_household_member(((storage.foldername(name))[1])::uuid))
  )
  with check (
    bucket_id = 'recipe-covers'
    and (select private.is_household_member(((storage.foldername(name))[1])::uuid))
  );

create policy recipe_covers_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'recipe-covers'
    and (select private.is_household_member(((storage.foldername(name))[1])::uuid))
  );

create policy recipe_step_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'recipe-step-images'
    and (select private.is_household_member(((storage.foldername(name))[1])::uuid))
  );

create policy recipe_step_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'recipe-step-images'
    and (select private.is_household_member(((storage.foldername(name))[1])::uuid))
  );

create policy recipe_step_images_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'recipe-step-images'
    and (select private.is_household_member(((storage.foldername(name))[1])::uuid))
  )
  with check (
    bucket_id = 'recipe-step-images'
    and (select private.is_household_member(((storage.foldername(name))[1])::uuid))
  );

create policy recipe_step_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'recipe-step-images'
    and (select private.is_household_member(((storage.foldername(name))[1])::uuid))
  );
