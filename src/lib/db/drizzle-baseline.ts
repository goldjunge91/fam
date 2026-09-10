/** Die erste gebündelte Migration ist eine vollständige lokale Datenbankbasis. */
export const DRIZZLE_BASELINE_NAME = '20260909071718_sweet_penance';
export const DRIZZLE_MIGRATIONS_TABLE = '__drizzle_migrations';

/** Stabiler, reiner Hash für den Inhalt eines gebündelten Migrationsquelltexts. */
export function hashMigrationSource(source: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= BigInt(source.charCodeAt(index));
    hash = (hash * prime) & mask;
  }

  return hash.toString(16).padStart(16, '0');
}
