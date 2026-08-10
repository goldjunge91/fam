import type { SqlDatabase } from '@/lib/db/types';

/**
 * Stellt sicher, dass die lokale Datenbank zum angemeldeten Nutzer gehoert.
 *
 * Zweite Verteidigungslinie hinter dem Logout: Das Aufraeumen dort ist
 * Best-Effort — es darf den Logout nicht scheitern lassen und schluckt seine
 * Fehler deshalb (`sign-out.ts`). Genau dann kann die Datei des Vornutzers
 * stehen bleiben, und bei lokal gespiegelten Haushaltsdaten ist das ein
 * Datenleck, kein Schoenheitsfehler.
 *
 * Hier als eigene Datei und ohne `expo-sqlite`, damit die Entscheidung
 * ("verwerfen oder behalten") ohne Geraet pruefbar ist. `client.ts` liefert nur
 * das `wipeAndReopen` dazu.
 *
 * Das Verwerfen laeuft ueber den Callback statt ueber einen direkten Aufruf von
 * `deleteLocalDatabase()`: Der Wipe muss in `client.ts` innerhalb desselben
 * Oeffnungs-Mutex passieren wie die Pruefung. Sonst greift ein zweiter Aufrufer
 * auf die gerade geloeschte Datei zu.
 */
export async function ensureDatabaseBelongsTo(
  db: SqlDatabase,
  userId: string,
  wipeAndReopen: () => Promise<SqlDatabase>,
): Promise<SqlDatabase> {
  const row = await db.getFirstAsync<{ value: string }>(
    'select value from app_meta where key = ?',
    ['user_id'],
  );

  if (row?.value === userId) return db;

  let current = db;

  // Nur bei einer *fremden* Id verwerfen. Fehlt der Eintrag, ist die Datenbank
  // frisch (oder stammt aus der Zeit vor dieser Pruefung) — dann gibt es nichts
  // zu schuetzen, und ein Wipe wuerde nur die Daten des rechtmaessigen Nutzers
  // wegwerfen.
  if (row?.value !== undefined && row.value !== userId) {
    current = await wipeAndReopen();
  }

  await current.runAsync('insert or replace into app_meta (key, value) values (?, ?)', [
    'user_id',
    userId,
  ]);

  return current;
}
