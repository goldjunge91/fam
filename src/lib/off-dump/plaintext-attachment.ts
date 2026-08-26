import type { SqlDatabase } from '@/lib/db/types';

const SAFE_ALIAS = /^[a-z_][a-z0-9_]*$/i;

function escapeSqlPath(path: string): string {
  return path.replace(/'/g, "''");
}

export type PlaintextAttachmentMode = 'sqlcipher' | 'sqlite';

export function plaintextAttachSql(
  path: string,
  alias: string,
  mode: PlaintextAttachmentMode,
): string {
  if (!SAFE_ALIAS.test(alias)) throw new Error(`Ungültiger SQLite-Alias: ${alias}`);
  const keyClause = mode === 'sqlcipher' ? " KEY ''" : '';
  return `ATTACH DATABASE '${escapeSqlPath(path)}' AS ${alias}${keyClause}`;
}

export async function attachPlaintextDatabase(
  db: SqlDatabase,
  path: string,
  alias: string,
  mode: PlaintextAttachmentMode,
): Promise<void> {
  await db.execAsync(plaintextAttachSql(path, alias, mode));
}
