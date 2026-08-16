-- Gewuenschter Endzustand — NICHT von Hand migrieren.
--
-- RLS fuer den Storage-Bucket `recipe-covers` (Titelbilder, #125). Der Bucket
-- selbst wird NICHT hier angelegt: `insert into storage.buckets` ist DML, kein
-- DDL, und wird vom Schema-Diff nicht erfasst (siehe bekannte Cavea­ts in
-- AGENTS.md). Der Bucket steht stattdessen in `supabase/seed.sql` (lokal) und
-- muss auf dem verlinkten Projekt einmalig manuell angelegt werden.
--
-- ACHTUNG (gegengeprueft 2026-08-12): `storage` ist ein von Supabase
-- verwaltetes System-Schema, `db diff` vergleicht nur die von uns selbst
-- deklarierten Schemas — `storage.objects` gehoert strukturell nie zum
-- verglichenen Objektbestand, egal ob `migra` oder `pg-delta` laeuft. Die
-- Policies hier laufen zwar gegen die Schatten-DB beim Diffen ("Seeding
-- globals"), landen aber in KEINER generierten Migration.
--
-- Verbindlich angewendet werden diese Policies deshalb ueber die
-- dokumentierten Ausnahme-Migrationen unter `supabase/migrations/`.
-- Aendert sich eine Policy, braucht sie dort eine explizite Folgemigration.
-- `supabase/tests/10_recipes.test.sql` prueft das Ergebnis und schlaegt an,
-- wenn die Policies fehlen.
--
-- Pfadkonvention: Nutzer-Cover liegen unter
-- `<household_id>/<recipe_id>.<ext>`. Kuratierte Template-Cover liegen unter
-- `templates/<template_id>.jpg` und sind fuer alle angemeldeten Nutzer lesbar.
-- Schreiben duerfen Clients weiterhin ausschliesslich in Haushalts-Pfade.

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
