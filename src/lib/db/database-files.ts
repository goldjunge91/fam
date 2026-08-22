/**
 * Breaking SQLite-Epoch fuer Issue #223.
 *
 * Die App oeffnet die alten Dateien bewusst nie wieder: `fam-v2.db` wird aus
 * Supabase gebootstrapped, `off-dump-v2.db` enthaelt ausschliesslich den
 * oeffentlichen OFF-Katalog und kann unabhaengig ersetzt werden.
 */
export const DATABASE_FILE_NAMES = {
  main: 'fam-v2.db',
  offDump: 'off-dump-v2.db',
} as const;
