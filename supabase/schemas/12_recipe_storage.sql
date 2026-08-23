-- Gewuenschter Endzustand — NICHT von Hand migrieren.
-- Storage-Buckets sind DML aus seed.sql; das verwaltete storage-Schema fehlt in db diff.
-- Policy-Aenderungen brauchen deshalb die dokumentierte Storage-Ausnahme-Migration.
-- Nutzer-Cover liegen unter <household_id>/<recipe_id>.<ext>, lesbare Vorlagen
-- unter templates/<template_id>.jpg. Clients schreiben nur in Haushalts-Pfade.

create policy recipe_covers_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'recipe-covers'
    and case
      when (storage.foldername(name))[1] = 'templates' then true
      else (select private.is_household_member(((storage.foldername(name))[1])::uuid))
    end
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
