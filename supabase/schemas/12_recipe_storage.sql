-- Gewuenschter Endzustand — NICHT von Hand migrieren.
--
-- RLS fuer den Storage-Bucket `recipe-covers` (Titelbilder, #125). Der Bucket
-- selbst wird NICHT hier angelegt: `insert into storage.buckets` ist DML, kein
-- DDL, und wird vom Schema-Diff nicht erfasst (siehe bekannte Cavea­ts in
-- AGENTS.md). Der Bucket steht stattdessen in `supabase/seed.sql` (lokal) und
-- muss auf dem verlinkten Projekt einmalig manuell angelegt werden.
--
-- ACHTUNG (gegengeprueft 2026-08-12): `storage.objects` liegt ausserhalb des
-- Schemas, das `db diff` vergleicht — dieselbe Kategorie Luecke wie
-- `alter publication` in `10_realtime.sql`. Die Policies hier laufen zwar
-- gegen die Schatten-DB beim Diffen ("Seeding globals"), landen aber in
-- KEINER generierten Migration und fehlen deshalb nach einem echten
-- `db reset`/`db push`, bis sie einmalig manuell nachgezogen werden
-- (`supabase db query [--linked] < supabase/schemas/12_recipe_storage.sql`).
-- `supabase/tests/10_recipes.test.sql` prueft das Ergebnis und schlaegt an,
-- wenn sie fehlen.
--
-- Pfadkonvention: `<household_id>/<recipe_id>.<ext>` — der erste Pfad-
-- Abschnitt traegt die Haushalts-Id, damit RLS ohne Zusatztabelle pruefen
-- kann, wer ein Bild lesen/schreiben darf. `storage.foldername(name)` liefert
-- die Pfad-Abschnitte als Array, Index 1 ist der erste.

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
