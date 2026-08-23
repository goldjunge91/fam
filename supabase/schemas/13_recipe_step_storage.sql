-- Gewuenschter Endzustand — NICHT von Hand migrieren.
-- Storage-Buckets sind DML aus seed.sql; das verwaltete storage-Schema fehlt in db diff.
-- Policy-Aenderungen brauchen deshalb die dokumentierte Storage-Ausnahme-Migration.
-- Schrittbilder liegen unter <household_id>/<step_id>.<ext>; das erste
-- Pfadsegment liefert die Haushalts-ID fuer RLS.

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
