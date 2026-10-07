#!/usr/bin/env bash
set -euo pipefail

# Deployt die Supabase Edge Function brochure-image und setzt ihre Secrets
# aus einer lokalen Env-Datei (.env.development.local, .env.preview, ...).
#
# Aufruf:
#   bash scripts/deploy-brochure-image.sh --env .env.development.local
#   bash scripts/deploy-brochure-image.sh --env .env.preview --no-deploy
#
# Benoetigte Variablen in der Env-Datei:
#   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
# Optional:
#   BROCHURE_IMAGE_TTL_SECONDS (default 60)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILE=""
NO_DEPLOY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      [[ -n "${2:-}" ]] || { echo "❌ --env benötigt eine Datei." >&2; exit 1; }
      ENV_FILE="$2"
      shift 2
      ;;
    --no-deploy)
      NO_DEPLOY=true
      shift
      ;;
    *)
      echo "❌ Unbekanntes Argument: $1" >&2
      echo "Verwendung: bash scripts/deploy-brochure-image.sh --env .env.development.local [--no-deploy]" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$ENV_FILE" ]]; then
  echo "❌ --env fehlt." >&2
  echo "Verwendung: bash scripts/deploy-brochure-image.sh --env .env.development.local [--no-deploy]" >&2
  exit 1
fi

if [[ ! -f "$ROOT_DIR/$ENV_FILE" ]]; then
  echo "❌ Env-Datei nicht gefunden: $ROOT_DIR/$ENV_FILE" >&2
  exit 1
fi

REQUIRED=(R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET)
MISSING=()

for key in "${REQUIRED[@]}"; do
  value=$(grep -E "^${key}=" "$ROOT_DIR/$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' || true)
  if [[ -z "$value" ]]; then
    MISSING+=("$key")
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "❌ ${#MISSING[@]} Variable(n) fehlen in $ENV_FILE: ${MISSING[*]}" >&2
  exit 1
fi

echo "==> Lade Supabase-Projektverknuepfung..."
supabase link --project-ref ivvebtqasotqpikuydov

echo "==> Setze Secrets aus $ENV_FILE..."
supabase secrets set \
  R2_ACCOUNT_ID="$(grep -E '^R2_ACCOUNT_ID=' "$ROOT_DIR/$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"')" \
  R2_ACCESS_KEY_ID="$(grep -E '^R2_ACCESS_KEY_ID=' "$ROOT_DIR/$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"')" \
  R2_SECRET_ACCESS_KEY="$(grep -E '^R2_SECRET_ACCESS_KEY=' "$ROOT_DIR/$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"')" \
  R2_BUCKET="$(grep -E '^R2_BUCKET=' "$ROOT_DIR/$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"')"

# Optionaler TTL-Wert, falls gesetzt.
if ttl=$(grep -E '^BROCHURE_IMAGE_TTL_SECONDS=' "$ROOT_DIR/$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'); then
  [[ -n "$ttl" ]] && supabase secrets set BROCHURE_IMAGE_TTL_SECONDS="$ttl"
fi

if $NO_DEPLOY; then
  echo "✅ Secrets gesetzt (Deploy übersprungen)."
  exit 0
fi

echo "==> Deploye brochure-image..."
supabase functions deploy brochure-image

echo ""
echo "✅ brochure-image deployed und Secrets gesetzt."
