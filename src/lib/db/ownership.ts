import type { SqlDatabase } from '@/lib/db/types';

/**
 * Stellt sicher, dass die lokale Datenbank zum angemeldeten Nutzer gehoert.
 *
 * Zweite Verteidigungslinie hinter dem Logout: Selbst wenn die App vor dem
 * vollständigen Cleanup beendet wurde, darf eine verbliebene Datei niemals
 * für einen anderen Nutzer freigegeben werden.
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
  assertCurrentUser: () => void = () => undefined,
): Promise<SqlDatabase> {
  const row = await db.getFirstAsync<{ value: string }>(
    'select value from app_meta where key = ?',
    ['user_id'],
  );

  assertCurrentUser();
  if (row?.value === userId) return db;

  let current = db;

  // Nur bei einer *fremden* Id verwerfen. Fehlt der Eintrag, ist die Datenbank
  // frisch (oder stammt aus der Zeit vor dieser Pruefung) — dann gibt es nichts
  // zu schuetzen, und ein Wipe wuerde nur die Daten des rechtmaessigen Nutzers
  // wegwerfen.
  if (row?.value !== undefined && row.value !== userId) {
    current = await wipeAndReopen();
    assertCurrentUser();
  }

  // Direkt vor dem einzigen Ownership-Write noch einmal prüfen: Ein parallel
  // eingetroffenes SIGNED_OUT darf den alten Open-Lauf nicht mehr publizieren.
  assertCurrentUser();
  await current.runAsync('insert or replace into app_meta (key, value) values (?, ?)', [
    'user_id',
    userId,
  ]);

  return current;
}
