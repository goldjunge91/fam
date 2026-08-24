const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Richtet die Integrationstests auf die Supabase-Instanz aus.
 *
 * Bevorzugt lokale `supabase status`-Werte, faellt bei fehlender lokaler
 * Instanz sauber auf die konfigurierte Remote Testing DB aus
 * `.env.development` zurueck.
 */

function readDotenv() {
  const envPath = path.resolve(__dirname, '../.env.development');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const values = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      values[key] = val;
    }
  }
  return values;
}

function resolveSupabaseEnv() {
  // 1. Lokales `supabase status` versuchen
  try {
    const raw = execFileSync('supabase', ['status', '-o', 'env'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const values = {};
    for (const line of raw.split('\n')) {
      const match = line.match(/^([A-Z_]+)="(.*)"$/);
      if (match) values[match[1]] = match[2];
    }
    if (values.API_URL && values.ANON_KEY) {
      return {
        url: values.API_URL,
        anonKey: values.ANON_KEY,
        serviceRoleKey: values.SERVICE_ROLE_KEY || '',
      };
    }
  } catch {
    // Keine lokale Instanz aktiv — nutze Umgebungsvariablen / .env.development
  }

  // 2. .env.development / process.env auslesen
  const env = readDotenv();
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY || env.EXPO_PUBLIC_SUPABASE_KEY;
  const serviceRoleKey =
    process.env.SUPABASE_SECRET_KEY ||
    env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Keine Supabase-Konfiguration gefunden. Bitte `.env.development` pflegen oder `supabase start` ausfuehren.',
    );
  }

  return { url, anonKey, serviceRoleKey };
}

const config = resolveSupabaseEnv();

process.env.EXPO_PUBLIC_SUPABASE_URL = config.url;
process.env.EXPO_PUBLIC_SUPABASE_KEY = config.anonKey;
process.env.SUPABASE_SERVICE_ROLE_KEY = config.serviceRoleKey;

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  init: jest.fn(),
  wrap: (fn) => fn,
  reactNavigationIntegration: jest.fn(() => ({})),
}));
