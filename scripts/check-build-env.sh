#!/usr/bin/env bash
# Prüft die statischen Umgebungsvariablen des produktiven Expo-Codes gegen eine Env-Datei.
#
# Verwendung:
#   bash scripts/check-build-env.sh .env.preview
#
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$PROJECT_ROOT/.env.preview}"

if [ ! -f "$ENV_FILE" ]; then
  printf 'Fehler: Env-Datei nicht gefunden: %s\n' "$ENV_FILE" >&2
  exit 1
fi

node - "$PROJECT_ROOT" "$ENV_FILE" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [projectRoot, envPath] = process.argv.slice(2);
const envText = fs.readFileSync(envPath, 'utf8');
const configured = new Map();

for (const line of envText.split(/\r?\n/u)) {
  const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/u);
  if (!match) continue;

  const value = match[2].trim();
  configured.set(match[1], value.replace(/^(['"])(.*)\1$/u, '$2').trim());
}

const sourceRoots = ['src', 'app.json', 'metro.config.js'];
const ignoredDirectories = new Set(['node_modules', '.git', 'ios', 'android', 'coverage']);
const sourceFiles = [];

function collect(entry) {
  const absolute = path.join(projectRoot, entry);
  if (!fs.existsSync(absolute)) return;

  const stats = fs.statSync(absolute);
  if (stats.isFile()) {
    sourceFiles.push(absolute);
    return;
  }

  for (const child of fs.readdirSync(absolute)) {
    if (ignoredDirectories.has(child)) continue;
    collect(path.join(entry, child));
  }
}

for (const root of sourceRoots) collect(root);

const referenced = new Set();
const referencePattern = /process\.env\.([A-Z][A-Z0-9_]*)|process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/gu;

for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const match of content.matchAll(referencePattern)) {
    referenced.add(match[1] ?? match[2]);
  }
}

// Diese Werte werden von Expo/Node gesetzt und gehören nicht in .env.preview.
const runtimeProvided = new Set(['EXPO_OS', 'NODE_ENV']);

// Diese Werte werden für einen TestFlight-Release tatsächlich benötigt.
const required = new Set([
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_KEY',
  'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
  'POSTHOG_CLI_API_KEY',
  'POSTHOG_CLI_PROJECT_ID',
  'POSTHOG_CLI_HOST',
]);

const names = [...new Set([...referenced, ...required])].sort();
const missingRequired = [];
const missingOptional = [];

for (const name of names) {
  if (runtimeProvided.has(name)) continue;
  const value = configured.get(name);
  if (value) continue;
  if (required.has(name)) missingRequired.push(name);
  else missingOptional.push(name);
}

console.log(`Prüfe ${names.length} Variablen aus dem produktiven Code gegen ${path.relative(projectRoot, envPath) || envPath}...`);

if (missingOptional.length > 0) {
  console.log(`Hinweis: optionale oder feature-spezifische Variablen fehlen: ${missingOptional.join(', ')}`);
}

if (missingRequired.length > 0) {
  console.error(`Fehler: buildkritische Variablen fehlen oder sind leer: ${missingRequired.join(', ')}`);
  process.exit(1);
}

console.log('OK: Alle buildkritischen Variablen sind gesetzt.');
NODE
