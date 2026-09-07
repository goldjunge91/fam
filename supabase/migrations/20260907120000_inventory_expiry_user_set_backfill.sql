-- Einmaliger, vom Maintainer freigegebener Daten-Backfill.
-- DML wird von Supabase Declarative Schema Diff nicht erfasst.
UPDATE public.fridge_items
SET expiry_user_set = true
WHERE expiry_date IS NOT NULL
  AND expiry_user_set = false;
