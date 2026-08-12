-- Gewuenschter Endzustand — NICHT von Hand migrieren.
--
-- RLS fuer den Storage-Bucket `recipe-step-images` (Bilder je
-- Zubereitungsschritt, Wizard-Redesign). Der Bucket selbst wird NICHT hier
-- angelegt: `insert into storage.buckets` ist DML, kein DDL, und wird vom
-- Schema-Diff nicht erfasst (siehe bekannte Caveats in AGENTS.md). Der
-- Bucket steht stattdessen in `supabase/seed.sql` (lokal) und muss auf dem
-- verlinkten Projekt einmalig manuell angelegt werden.
--
-- ACHTUNG (analog 12_recipe_storage.sql): `storage.objects` liegt ausserhalb
-- des Schemas, das `db diff` vergleicht. Die Policies hier laufen zwar gegen
-- die Schatten-DB beim Diffen ("Seeding globals"), landen aber in KEINER
-- generierten Migration und fehlen deshalb nach einem echten
-- `db reset`/`db push`, bis sie einmalig manuell nachgezogen werden
-- (`supabase db query [--linked] < supabase/schemas/13_recipe_step_storage.sql`).
-- `supabase/tests/10_recipes.test.sql` prueft das Ergebnis und schlaegt an,
-- wenn sie fehlen.
--
-- Pfadkonvention: `<household_id>/<step_id>.<ext>` — analog `recipe-covers`,
-- `storage.foldername(name)[1]` traegt die Haushalts-Id fuer die RLS-Pruefung.

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
