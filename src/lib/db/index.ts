// `client.ts` bleibt ausserhalb des Barrels, damit Logiktests kein natives Modul laden.

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
