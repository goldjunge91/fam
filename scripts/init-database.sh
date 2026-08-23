#!/usr/bin/env bash
# Initialisiert eine verlinkte Supabase-Datenbank inklusive Seeds und Functions.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "============================================================"
echo "🚀 NutriTrack: Initialisiere Supabase Projekt & Datenbank"
echo "============================================================"

echo ""
echo "==> 1/6: Wende alle Migrationen an (supabase db push)..."
supabase db push

echo ""
echo "==> 2/6: Haerte Rechte fuer sensible SECURITY DEFINER Funktionen..."
supabase db query --linked "
revoke execute on function public.create_household(text) from anon;
revoke execute on function public.redeem_invite(uuid) from anon;
revoke execute on function public.prepare_account_deletion() from anon;
revoke execute on function public.household_member_profiles(uuid) from anon;
"

echo ""
echo "==> 3/6: Spiele Seed-Daten ein (Buckets, Basis-Produkte, 29 Rezept-Templates)..."
supabase db query --linked < "$ROOT_DIR/supabase/seeds/recipe_templates.sql"

echo ""
echo "==> 4/6: Fuehre Rechte-Zusicherungs-Check aus..."
bash "$SCRIPT_DIR/check-privileges.sh" --linked

echo ""
echo "==> 5/6: Lade Rezeptvorlagen-Cover in Storage hoch..."
if [ -f "$SCRIPT_DIR/upload-recipe-template-covers.ts" ]; then
  bun --env-file=.env "$SCRIPT_DIR/upload-recipe-template-covers.ts" || {
    echo "⚠️  Warnung: Cover-Upload fehlgeschlagen. Bitte pruefe, ob SUPABASE_SECRET_KEY in deiner .env gueltig ist."
  }
else
  echo "Uebersprungen: Skript upload-recipe-template-covers.ts nicht gefunden."
fi

echo ""
echo "==> 6/6: Deploye Supabase Edge Functions..."
supabase functions deploy

echo ""
echo "============================================================"
echo "✅ Projekt-Initialisierung erfolgreich abgeschlossen!"
echo "============================================================"
