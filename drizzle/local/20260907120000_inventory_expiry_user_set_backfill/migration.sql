-- Einmaliger Upgrade-Backfill fuer bestehende lokale Bestandszeilen.
UPDATE fridge_items
SET expiry_user_set = 1
WHERE expiry_date IS NOT NULL
  AND expiry_user_set = 0;
