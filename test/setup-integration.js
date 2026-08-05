const { execFileSync } = require('node:child_process');

/**
 * Richtet die Integrationstests auf die LOKALE Supabase-Instanz aus.
 *
 * Bewusst NICHT ueber die `.env`: Die zeigt auf das verlinkte Remote-Projekt.
 * Ein Test, der Nutzer anlegt und wieder loescht, darf dort niemals landen —
 * und genau das waere beim ersten Lauf beinahe passiert.
 *
 * Die Werte kommen aus `supabase status`, damit sie nicht doppelt gepflegt
 * werden muessen und bei einem `supabase stop/start` automatisch stimmen.
 */

function readLocalSupabaseEnv() {
  let raw;
  try {
    raw = execFileSync('supabase', ['status', '-o', 'env'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    throw new Error(
      'Die lokale Supabase-Instanz laeuft nicht. Starte sie mit `supabase start` ' +
        'und fuehre den Test erneut aus.',
    );
  }

  const values = {};
  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Z_]+)="(.*)"$/);
    if (match) values[match[1]] = match[2];
  }

  if (!values.API_URL || !values.ANON_KEY) {
    throw new Error('`supabase status` lieferte weder API_URL noch ANON_KEY.');
  }

  return values;
}

const local = readLocalSupabaseEnv();

/**
 * Sicherung gegen den Fall, dass jemand diese Datei spaeter umbaut oder die
 * Werte anders befuellt. Ein Integrationstest, der Konten anlegt, darf
 * ausschliesslich gegen localhost laufen — hier bricht er sonst ab, statt in
 * einer fremden Datenbank Spuren zu hinterlassen.
 */
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(local.API_URL)) {
  throw new Error(
    `Integrationstests laufen nur gegen localhost. Erhalten: ${local.API_URL}`,
  );
}

process.env.EXPO_PUBLIC_SUPABASE_URL = local.API_URL;
process.env.EXPO_PUBLIC_SUPABASE_KEY = local.ANON_KEY;
