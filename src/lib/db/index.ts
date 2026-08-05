/**
 * Oeffentliche API des lokalen Datenbank-Layers (#45).
 *
 * **`client.ts` wird hier absichtlich NICHT re-exportiert.** Es ist die
 * einzige Datei, die `expo-sqlite` laedt; taeuchte sie in diesem Barrel auf,
 * zoege jeder Unit-Test, der irgendetwas von hier importiert, das native Modul
 * mit und schluege fehl. Wer den Treiber braucht, importiert
 * `@/lib/db/client` direkt — und tut das nur aus App-Code, nie aus Logik.
 */

export { MIGRATIONS } from '@/lib/db/migrations';
export {
  assertMigrationSequence,
  planMigrations,
  readUserVersion,
  runMigrations,
} from '@/lib/db/migrator';
export type {
  Entity,
  Migration,
  MirrorMeta,
  OutboxEntry,
  OutboxOp,
  SqlDatabase,
  SqlParam,
  SqlRunResult,
} from '@/lib/db/types';
