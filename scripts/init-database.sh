#!/usr/bin/env bash
#
# init-database.sh — Richtet eine neue oder gewechselte Supabase-Datenbank (linked)
# komplett ein, haertet die Berechtigungen, spielt Seed-Daten ein (Rezept-Templates,
# Basis-Produkte, Storage-Buckets), fuehrt Sicherheitspruefungen durch,
# laedt Standard-Storage-Assets hoch und deployt alle Edge Functions.
#
# Aufruf:
#   bun run db:init
#   oder: bash scripts/init-database.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "============================================================"
echo "🚀 NutriTrack: Initialisiere Supabase Projekt & Datenbank"
echo "============================================================"

# 1. Migrationen auf das verlinkte Projekt pushen
echo ""
echo "==> 1/6: Wende alle Migrationen an (supabase db push)..."
supabase db push

# 2. Rechte haerten (Supabase Remote Default Privileges fuer SECURITY DEFINER Funktionen entziehen)
echo ""
echo "==> 2/6: Haerte Rechte fuer sensible SECURITY DEFINER Funktionen..."
supabase db query --linked "
revoke execute on function public.create_household(text) from anon;
revoke execute on function public.redeem_invite(uuid) from anon;
revoke execute on function public.prepare_account_deletion() from anon;
revoke execute on function public.household_member_profiles(uuid) from anon;
"

# 3. Seed-Daten einspielen (Storage-Buckets, Basis-Produkte, 29 Rezept-Templates)
echo ""
echo "==> 3/6: Spiele Seed-Daten ein (Buckets, Basis-Produkte, 29 Rezept-Templates)..."
supabase db query --linked < "$ROOT_DIR/supabase/seeds/recipe_templates.sql"

# 4. Rechte-Zusicherungen ueberpruefen
echo ""
echo "==> 4/6: Fuehre Rechte-Zusicherungs-Check aus..."
bash "$SCRIPT_DIR/check-privileges.sh" --linked

# 5. Storage-Assets hochladen (Recipe Template Covers)
echo ""
echo "==> 5/6: Lade Rezeptvorlagen-Cover in Storage hoch..."
if [ -f "$SCRIPT_DIR/upload-recipe-template-covers.ts" ]; then
  bun --env-file=.env "$SCRIPT_DIR/upload-recipe-template-covers.ts" || {
    echo "⚠️  Warnung: Cover-Upload fehlgeschlagen. Bitte pruefe, ob SUPABASE_SECRET_KEY in deiner .env gueltig ist."
  }
else
  echo "Uebersprungen: Skript upload-recipe-template-covers.ts nicht gefunden."
fi

# 6. Edge Functions deployen
echo ""
echo "==> 6/6: Deploye Supabase Edge Functions..."
supabase functions deploy

echo ""
echo "============================================================"
echo "✅ Projekt-Initialisierung erfolgreich abgeschlossen!"
echo "============================================================"
