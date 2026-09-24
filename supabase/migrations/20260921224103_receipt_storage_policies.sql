-- Storage-Ausnahme-Migration fuer den privaten Receipt-Bucket.
--
-- Supabase Storage verwaltet `storage.objects` selbst; Policies aus
-- supabase/schemas/27_receipt_storage.sql werden deshalb nicht in die normale
-- Declarative-Diff-Migration uebernommen. Diese Fassung ist die wirksame
-- Deploy-Quelle und folgt dem bestehenden Recipe-Storage-Muster.

drop policy if exists receipt_images_select on storage.objects;
drop policy if exists receipt_images_insert on storage.objects;
drop policy if exists receipt_images_update on storage.objects;
drop policy if exists receipt_images_delete on storage.objects;

create policy receipt_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipt-images'
    and (select private.is_household_member(((storage.foldername(name))[1])::uuid))
  );

create policy receipt_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipt-images'
    and (select private.is_household_member(((storage.foldername(name))[1])::uuid))
  );

create policy receipt_images_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'receipt-images'
    and (select private.is_household_member(((storage.foldername(name))[1])::uuid))
  )
  with check (
    bucket_id = 'receipt-images'
    and (select private.is_household_member(((storage.foldername(name))[1])::uuid))
  );

create policy receipt_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipt-images'
    and (select private.is_household_member(((storage.foldername(name))[1])::uuid))
  );
