import type { SqlDatabase } from '@/lib/db/types';

/** Verwirft Daten eines Vornutzers innerhalb des Oeffnungs-Mutex aus `client.ts`. */
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

  // Eine fehlende Id kennzeichnet eine frische oder noch nicht markierte Datenbank.
  if (row?.value !== undefined && row.value !== userId) {
    current = await wipeAndReopen();
  }

  await current.runAsync('insert or replace into app_meta (key, value) values (?, ?)', [
    'user_id',
    userId,
  ]);

  return current;
}
