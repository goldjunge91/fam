-- Storage-Policies werden von pg-delta nicht erfasst, weil storage.objects
-- ein von Supabase verwaltetes Schema ist. Diese Ausnahme-Migration bringt
-- die lesenden Katalog-Policies auf Remote und lokal in Einklang.

drop policy if exists recipe_catalog_select on storage.objects;
create policy recipe_catalog_select on storage.objects
  for select to authenticated
  using (bucket_id = 'recipe-catalog');

drop policy if exists recipe_catalog_step_images_select on storage.objects;
create policy recipe_catalog_step_images_select on storage.objects
  for select to authenticated
  using (bucket_id = 'recipe-catalog');
