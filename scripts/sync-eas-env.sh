#!/usr/bin/env bash
# Überträgt ausgewählte Build-Variablen aus einer lokalen Env-Datei nach EAS.
#
# Verwendung:
#   bash scripts/sync-eas-env.sh preview
#   bash scripts/sync-eas-env.sh production
#   bash scripts/sync-eas-env.sh development
#   bash scripts/sync-eas-env.sh all --dry-run
#
# Absichtlich nicht enthalten: SUPABASE_SERVICE_ROLE_KEY und andere Backend-Secrets.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-preview}"
DRY_RUN=false

if [ "${2:-}" = "--dry-run" ]; then
  DRY_RUN=true
fi

command -v eas >/dev/null 2>&1 || {
  printf "Fehler: 'eas' wurde nicht gefunden. Installiere zuerst eas-cli.\n" >&2
  exit 1
}

case "$TARGET" in
  development)
    TARGETS=(development)
    ;;
  preview)
    TARGETS=(preview)
    ;;
  production)
    TARGETS=(production)
    ;;
  all)
    TARGETS=(development preview production)
    ;;
  *)
    printf 'Verwendung: %s [development|preview|production|all] [--dry-run]\n' "$0" >&2
    exit 1
    ;;
esac

for EAS_ENV in "${TARGETS[@]}"; do
  case "$EAS_ENV" in
    development) ENV_FILE="$PROJECT_ROOT/.env.development.local" ;;
    preview) ENV_FILE="$PROJECT_ROOT/.env.preview" ;;
    production) ENV_FILE="$PROJECT_ROOT/.env.production" ;;
  esac

  [ -f "$ENV_FILE" ] || {
    printf 'Fehler: Env-Datei nicht gefunden: %s\n' "$ENV_FILE" >&2
    exit 1
  }

  node - "$PROJECT_ROOT" "$ENV_FILE" "$DRY_RUN" "$EAS_ENV" <<'NODE'
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const [projectRoot, envPath, dryRun, easEnvironment] = process.argv.slice(2);
const values = dotenv.parse(fs.readFileSync(envPath));

const variables = [
  // Der CLI-Key wird nur vom EAS-Build benötigt und bleibt serverseitig geheim.
  // Lokale Builds laden ihn weiterhin über dotenv aus der lokalen Env-Datei.
  { name: 'POSTHOG_CLI_API_KEY', visibility: 'secret' },
  { name: 'POSTHOG_CLI_PROJECT_ID', visibility: 'sensitive' },
  { name: 'POSTHOG_CLI_HOST', visibility: 'sensitive' },
  { name: 'SENTRY_AUTH_TOKEN', visibility: 'sensitive' },

  // AdMob-IDs sind öffentliche Client-Werte.
  { name: 'EXPO_PUBLIC_ADMOB_BANNER_ID_IOS', visibility: 'plaintext' },
  { name: 'EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_IOS', visibility: 'plaintext' },
];
const optionalVariables = [
  // Ohne diesen Wert bleibt Werbung in der App aus Kompatibilitätsgründen aktiviert.
  { name: 'EXPO_PUBLIC_ADS_ENABLED', visibility: 'plaintext' },
];

const missing = variables.filter(({ name }) => !values[name]?.trim());
if (missing.length > 0) {
  console.error(`Fehler: Diese Variablen fehlen in ${path.relative(projectRoot, envPath) || envPath}:`);
  for (const { name } of missing) console.error(`  - ${name}`);
  process.exit(1);
}

const configuredVariables = [
  ...variables,
  ...optionalVariables.filter(({ name }) => values[name]?.trim()),
];

for (const { name, visibility } of configuredVariables) {
  const args = [
    'env:set',
    '--name', name,
    '--value', values[name],
    '--environment', easEnvironment,
    '--scope', 'project',
    '--type', 'string',
    '--visibility', visibility,
    '--non-interactive',
  ];

  if (dryRun === 'true') {
    console.log(`[dry-run] ${name} -> EAS ${easEnvironment} (${visibility})`);
    continue;
  }

  const result = spawnSync('eas', args, { cwd: projectRoot, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`Fehler: EAS-Variable ${name} konnte nicht gesetzt werden.`);
    process.exit(result.status ?? 1);
  }
  console.log(`OK: ${name} -> EAS ${easEnvironment} (${visibility})`);
}

console.log(dryRun === 'true' ? `Dry-run für EAS ${easEnvironment} erfolgreich.` : `EAS-Umgebungsvariablen für ${easEnvironment} erfolgreich synchronisiert.`);
NODE
done

if [ "$DRY_RUN" = true ]; then
  printf 'Dry-run erfolgreich. Es wurde nichts zu EAS übertragen.\n'
fi
