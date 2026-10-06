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
#   bash harness/diagnose-storage-upload.sh ios
#   bash harness/diagnose-storage-upload.sh android
set -euo pipefail

RUNNER="${1:-ios}"
cd "$(dirname "$0")/.."

case "$RUNNER" in
  ios) FAILURE_HOST="127.0.0.1" ;;
  android) FAILURE_HOST="10.0.2.2" ;;
  *) echo "Runner muss ios oder android sein: $RUNNER" >&2; exit 1 ;;
esac

FAM_FETCH_FIXTURE_PORT=8787 bun harness/fetch-failure-fixture.ts >/dev/null 2>&1 &
FIXTURE_PID=$!
cleanup_fixture() {
  kill "$FIXTURE_PID" 2>/dev/null || true
  wait "$FIXTURE_PID" 2>/dev/null || true
}
trap cleanup_fixture EXIT

for attempt in {1..30}; do
  if [[ "$(curl -fsS http://127.0.0.1:8787/health 2>/dev/null || true)" == "fetch-fixture-ready" ]]; then
    break
  fi
  if ! kill -0 "$FIXTURE_PID" 2>/dev/null; then
    echo "Fetch-Fehler-Fixture konnte Port 8787 nicht starten." >&2
    exit 1
  fi
  sleep 0.1
done
export EXPO_PUBLIC_HARNESS_FAILURE_URL="http://${FAILURE_HOST}:8787"

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
  python3 - "$ENV_FILE" "$key" "$value" <<'PY'
from pathlib import Path
import sys

env_path = Path(sys.argv[1])
key, value = sys.argv[2:]
lines = env_path.read_text().splitlines() if env_path.exists() else []
updated = False
for index, line in enumerate(lines):
    if line.startswith(f"{key}="):
        lines[index] = f"{key}={value}"
        updated = True
if not updated:
    lines.append(f"{key}={value}")
env_path.write_text("\n".join(lines) + "\n")
PY
}
set_env_line "EXPO_PUBLIC_HARNESS_TEST_EMAIL" "$EMAIL"
set_env_line "EXPO_PUBLIC_HARNESS_TEST_PASSWORD" "$PASSWORD"
set_env_line "EXPO_PUBLIC_HARNESS_SUPABASE_URL" "$LOCAL_URL"
set_env_line "EXPO_PUBLIC_HARNESS_SUPABASE_KEY" "$LOCAL_ANON_KEY"

echo "== 4/4 Harness-Matrix ausfuehren ($RUNNER) =="
echo "   Vergleicht Expo-, RN-fetch- und Expo-mit-Timeout-Transporte fuer abgebrochene Responses und Uint8Array-Uploads."
echo
FAM_HARNESS_UI=1 bun --env-file="$ENV_FILE" run react-native-harness \
  --config jest.harness.config.mjs \
  --harnessRunner "$RUNNER" \
  --watchman=false \
  --testPathPatterns=storage-upload-matrix

echo
echo "Diagnose abgeschlossen. Die Matrix steht im Harness-Output"
echo "(Suche nach '[storage-matrix]'). Cleanup der Diagnose-Objekte"
echo "erfolgt im letzten Test; der Diagnose-Haushalt bleibt lokal erhalten."
