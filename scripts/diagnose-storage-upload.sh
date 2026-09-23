#!/usr/bin/env bash
# Storage-Upload-Diagnose: prueft den gewaehlten Uint8Array-Transport in der
# echten App-Runtime (iOS-Simulator oder Android-Emulator).
#
# Voraussetzungen:
#   - Dev Build installiert (bun run ios / android)
#   - Simulator/Emulator laeuft
#   - Lokales Supabase laeuft (supabase start)
#
# Nutzung:
#   bash scripts/diagnose-storage-upload.sh ios
#   bash scripts/diagnose-storage-upload.sh android
set -euo pipefail

RUNNER="${1:-ios}"
cd "$(dirname "$0")/.."

ENV_FILE=".env.development.local"
EMAIL="storage-diag@example.com"
PASSWORD="StorageDiag123!"

echo "== 1/4 Supabase-Status pruefen =="
if ! supabase status >/dev/null 2>&1; then
  echo "Lokales Supabase laeuft nicht. Starte: supabase start"
  exit 1
fi

echo "== 2/4 Test-Account anlegen ($EMAIL) =="
# test-users.ts verlangt den lokalen Service-Role-Key als Umgebungsvariable.
export SUPABASE_SERVICE_ROLE_KEY="$(supabase status --output json | python3 -c "import json,sys; print(json.load(sys.stdin)['SERVICE_ROLE_KEY'])")"
# Idempotent: existiert der Account schon, ist das kein Fehler.
bun scripts/test-users.ts create "$EMAIL" "$PASSWORD" "Storage Diag" 2>&1 | grep -v "already been registered" || true

echo "== 3/4 Harness-Credentials in $ENV_FILE setzen =="
# harness:dev laedt .env.development.local ueber Buns --env-file.
# Die Diagnose-Zeilen werden idempotent ersetzt. Der Diagnose-
# Client zeigt bewusst auf die lokale Instanz, unabhaengig vom App-Projekt.
LOCAL_STATUS_JSON="$(supabase status --output json)"
LOCAL_URL="$(echo "$LOCAL_STATUS_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['API_URL'])")"
LOCAL_ANON_KEY="$(echo "$LOCAL_STATUS_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['ANON_KEY'])")"
set_env_line() {
  local key="$1" value="$2"
  if [[ -f "$ENV_FILE" ]] && grep -q "^${key}=" "$ENV_FILE"; then
    sed -i '' "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}
set_env_line "EXPO_PUBLIC_HARNESS_TEST_EMAIL" "$EMAIL"
set_env_line "EXPO_PUBLIC_HARNESS_TEST_PASSWORD" "$PASSWORD"
set_env_line "EXPO_PUBLIC_HARNESS_SUPABASE_URL" "$LOCAL_URL"
set_env_line "EXPO_PUBLIC_HARNESS_SUPABASE_KEY" "$LOCAL_ANON_KEY"

echo "== 4/4 Harness-Matrix ausfuehren ($RUNNER) =="
echo "   Alle Dateigroessen muessen via Uint8Array, storage.upload() und expo/fetch funktionieren."
echo
bun run harness:dev -- --harnessRunner "$RUNNER" --watchman=false --testPathPatterns=storage-upload-matrix

echo
echo "Diagnose abgeschlossen. Die Matrix steht im Harness-Output"
echo "(Suche nach '[storage-matrix]'). Cleanup der Diagnose-Objekte"
echo "erfolgt im letzten Test; der Diagnose-Haushalt bleibt lokal erhalten."
