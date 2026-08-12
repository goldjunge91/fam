-- Seed-Daten fuer `supabase db reset` (lokal). Laeuft NICHT gegen das
-- verlinkte Projekt — Bucket-Anlage auf Remote ist ein einmaliger manueller
-- Schritt (siehe Kommentar in supabase/schemas/12_recipe_storage.sql).
--
-- `insert into storage.buckets` ist DML, kein DDL, und wird deshalb hier
-- statt in einer Schemadatei gepflegt.

insert into storage.buckets (id, name, public, file_size_limit)
values ('recipe-covers', 'recipe-covers', false, 5242880)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('recipe-step-images', 'recipe-step-images', false, 5242880)
on conflict (id) do nothing;
