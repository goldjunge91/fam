-- Gewuenschter Endzustand — NICHT von Hand migrieren.
--
-- `storage.objects` ist ein von Supabase verwaltetes Schema. Die Policies
-- werden hier als lesbare deklarative Quelle beschrieben, aber nicht von
-- `pg-delta` in eine normale Migration uebernommen. Die wirksame Fassung
-- liegt deshalb in der dokumentierten Storage-Ausnahme-Migration.
--
-- Pfadkonvention: <household_id>/<receipt_id>/<asset_id>.<ext>.
-- Der Bucket ist privat; Zugriffe erfolgen nur ueber Storage-API bzw.
-- kurzlebige Signed URLs fuer authentifizierte Haushaltsmitglieder.

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
