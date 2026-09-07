import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const checkOnly = process.argv[2] === '--check-only';
const databaseUrl =
  process.env.SUPABASE_DB_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const query = await Bun.file(resolve(import.meta.dir, 'check-clean-db.sql')).text();
const database = new Bun.SQL(databaseUrl);

try {
  const rows = await database.unsafe<{ dirty_tables: Record<string, number> | null }[]>(query);
  const dirtyTables = rows[0]?.dirty_tables ?? null;

  if (dirtyTables === null || Object.keys(dirtyTables).length === 0) {
    console.log('==> DB sauber (public ist wie nach einem Reset leer).');
    process.exit(0);
  }

  console.log(
    `==> Lokale DB enthaelt Daten ausserhalb der Test-Transaktionen: ${JSON.stringify(dirtyTables)}`,
  );
  console.log(
    '    pgTAP zaehlt Zeilen absolut (z. B. 05_products.test.sql) — das faellt sonst falsch durch.',
  );

  if (checkOnly) {
    console.error('    Fix: bun run db:reset');
    process.exit(1);
  }

  console.log('==> Setze zurueck: supabase db reset');
  const reset = spawnSync('supabase', ['db', 'reset'], {
    cwd: resolve(import.meta.dir, '..'),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (reset.status !== 0) {
    process.exit(reset.status ?? 1);
  }

  console.log('==> OK, DB zurueckgesetzt.');
} catch (error) {
  console.error('Fehler: lokale Supabase-Datenbank konnte nicht geprüft werden.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await database.close();
}
