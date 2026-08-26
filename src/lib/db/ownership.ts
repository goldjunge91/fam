import type { SqlDatabase } from '@/lib/db/types';

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

  // Nur bei einer fremden ID verwerfen; eine fehlende ID bezeichnet eine frische oder alte DB.
  if (row?.value !== undefined && row.value !== userId) {
    current = await wipeAndReopen();
    assertCurrentUser();
  }

  // Vor dem Ownership-Write erneut prüfen, damit SIGNED_OUT keinen alten Lauf publiziert.
  assertCurrentUser();
  await current.runAsync('insert or replace into app_meta (key, value) values (?, ?)', [
    'user_id',
    userId,
  ]);

  return current;
}
