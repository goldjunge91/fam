import type { SqlDatabase } from '@/lib/db/types';

export const DRIZZLE_BASELINE_NAME = '20260826200344_worthless_celestials';
export const DRIZZLE_BASELINE_USER_VERSION = 21;
export const DRIZZLE_BASELINE_META_KEY = 'drizzle_baseline';
export const DRIZZLE_MIGRATIONS_TABLE = '__drizzle_migrations';

// Wird von drizzle-baseline.test.ts gegen die reale V1–V21-Migrationskette
// geprüft. Schemaänderungen müssen den Fingerprint bewusst aktualisieren.
export const DRIZZLE_BASELINE_FINGERPRINT = '0cbbc1d530454d81';

type TableRow = { name: string };
type ColumnRow = {
  cid: number;
  name: string;
  type: string;
  not_null: number;
  default_value: string | null;
  primary_key_position: number;
};
type IndexRow = {
  name: string;
  is_unique: number;
  origin: string;
  is_partial: number;
};
type IndexColumnRow = { sequence: number; name: string | null };
type IndexSqlRow = { sql: string | null };
type TableSqlRow = { sql: string };

function normalizeDefault(value: string | null): string {
  if (value === null) return '';

  const normalized = value.trim().toLowerCase();
  if (normalized === 'false') return '0';
  if (normalized === 'true') return '1';
  return normalized;
}

function normalizeSql(value: string): string {
  return value.toLowerCase().replaceAll(/[`"']/g, '').replaceAll(/\s+/g, ' ').trim();
}

function indexPredicate(source: string | null): string {
  if (!source) return '';
  const match = /\bwhere\b([\s\S]+)$/i.exec(source);
  return match ? normalizeSql(match[1]).replaceAll(/\b[a-z_]\w*\./g, '') : '';
}

function checkExpressions(source: string): string[] {
  const normalized = normalizeSql(source).replaceAll(/\b[a-z_]\w*\./g, '');
  const expressions: string[] = [];
  const checkStart = /\bcheck\s*\(/g;
  let match = checkStart.exec(normalized);

  while (match) {
    const expressionStart = checkStart.lastIndex;
    let depth = 1;
    let cursor = expressionStart;

    for (; cursor < normalized.length && depth > 0; cursor += 1) {
      if (normalized[cursor] === '(') depth += 1;
      if (normalized[cursor] === ')') depth -= 1;
    }

    if (depth !== 0) throw new Error('Ungültige CHECK-Klammerung im lokalen SQLite-Schema.');
    expressions.push(
      normalized
        .slice(expressionStart, cursor - 1)
        .replaceAll(/\s*([(),=])\s*/g, '$1')
        .trim(),
    );
    checkStart.lastIndex = cursor;
    match = checkStart.exec(normalized);
  }

  return expressions.sort();
}

/** Stabiler, reiner Hash für einen bereits kanonisierten Schema-String. */
export function hashSchemaShape(shape: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;

  for (let index = 0; index < shape.length; index += 1) {
    hash ^= BigInt(shape.charCodeAt(index));
    hash = (hash * prime) & mask;
  }

  return hash.toString(16).padStart(16, '0');
}

/**
 * Beschreibt Tabellen, Spalten und Indizes semantisch statt anhand formatierten
 * CREATE-SQLs. Dadurch sind die alte handgeschriebene V1–V22-Kette und die
 * äquivalente Drizzle-Startmigration trotz anderer Quotes/Constraint-Namen
 * vergleichbar.
 */
export async function readLocalSchemaShape(db: SqlDatabase): Promise<string> {
  const tables = await db.getAllAsync<TableRow>(
    `select name
       from sqlite_schema
      where type = 'table'
        and name not like 'sqlite_%'
        and name <> ?
      order by name`,
    [DRIZZLE_MIGRATIONS_TABLE],
  );
  const shape: string[] = [];

  for (const table of tables) {
    const tableDefinition = await db.getFirstAsync<TableSqlRow>(
      `select sql from sqlite_schema where type = 'table' and name = ?`,
      [table.name],
    );
    if (!tableDefinition) throw new Error(`SQLite-Schema für ${table.name} fehlt.`);

    const columns = await db.getAllAsync<ColumnRow>(
      `select cid,
              name,
              type,
              "notnull" as not_null,
              dflt_value as default_value,
              pk as primary_key_position
         from pragma_table_info(?)
        order by cid`,
      [table.name],
    );
    shape.push(`table:${table.name}`);
    for (const column of columns) {
      // INTEGER PRIMARY KEY ist SQLite's rowid-Alias und dadurch unabhängig
      // vom PRAGMA-notnull-Bit nicht nullable. Textschlüssel werden dagegen
      // absichtlich nicht normalisiert: dort muss Drizzle `NOT NULL` erhalten.
      const notNull =
        column.primary_key_position > 0 && column.type.toLowerCase() === 'integer'
          ? 1
          : column.not_null;
      shape.push(
        `column:${column.cid}:${column.name}:${column.type.toLowerCase()}:${notNull}:` +
          `${normalizeDefault(column.default_value)}:${column.primary_key_position}`,
      );
    }
    for (const expression of checkExpressions(tableDefinition.sql)) {
      shape.push(`check:${expression}`);
    }

    const indexes = await db.getAllAsync<IndexRow>(
      `select name,
              "unique" as is_unique,
              origin,
              partial as is_partial
         from pragma_index_list(?)
        order by name`,
      [table.name],
    );
    for (const currentIndex of indexes) {
      const columns = await db.getAllAsync<IndexColumnRow>(
        `select seqno as sequence, name
           from pragma_index_info(?)
          order by seqno`,
        [currentIndex.name],
      );
      const definition = await db.getFirstAsync<IndexSqlRow>(
        `select sql from sqlite_schema where type = 'index' and name = ?`,
        [currentIndex.name],
      );
      shape.push(
        `index:${currentIndex.name}:${currentIndex.is_unique}:${currentIndex.origin}:` +
          `${currentIndex.is_partial}:${columns.map((column) => column.name ?? '').join(',')}:` +
          indexPredicate(definition?.sql ?? null),
      );
    }
  }

  return shape.join('\n');
}

export async function readLocalSchemaFingerprint(db: SqlDatabase): Promise<string> {
  return hashSchemaShape(await readLocalSchemaShape(db));
}

/**
 * Übernimmt eine vollständig migrierte Bestandsdatenbank in Drizzles Historie.
 * Die Startmigration wird nur als ausgeführt markiert, wenn die V1–V21-Kette
 * exakt den erwarteten strukturellen Fingerprint erzeugt hat.
 */
export async function ensureDrizzleBaseline(db: SqlDatabase): Promise<void> {
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const marker = await transaction.getFirstAsync<{ value: string | null }>(
      'select value from app_meta where key = ?',
      [DRIZZLE_BASELINE_META_KEY],
    );
    const expectedMarker = `${DRIZZLE_BASELINE_NAME}:${DRIZZLE_BASELINE_FINGERPRINT}`;

    if (marker?.value === expectedMarker) return;
    if (marker) {
      throw new Error(`Unbekannter Drizzle-Baseline-Marker: ${marker.value ?? '<null>'}`);
    }

    const version = await transaction.getFirstAsync<{ user_version: number }>(
      'PRAGMA user_version',
    );
    if (version?.user_version !== DRIZZLE_BASELINE_USER_VERSION) {
      throw new Error(
        `Drizzle-Baseline erwartet SQLite user_version ${DRIZZLE_BASELINE_USER_VERSION}, ` +
          `gefunden: ${version?.user_version ?? 0}.`,
      );
    }

    const fingerprint = await readLocalSchemaFingerprint(transaction);
    if (fingerprint !== DRIZZLE_BASELINE_FINGERPRINT) {
      throw new Error(
        `Lokales Schema passt nicht zur Drizzle-Baseline ` +
          `(erwartet ${DRIZZLE_BASELINE_FINGERPRINT}, gefunden ${fingerprint}).`,
      );
    }

    await transaction.execAsync(`
      create table if not exists ${DRIZZLE_MIGRATIONS_TABLE} (
        id integer primary key,
        hash text not null,
        created_at numeric,
        name text,
        applied_at text
      )
    `);
    await transaction.runAsync(
      `insert into ${DRIZZLE_MIGRATIONS_TABLE} (hash, created_at, name, applied_at)
       select ?, ?, ?, ?
        where not exists (
          select 1 from ${DRIZZLE_MIGRATIONS_TABLE} where name = ?
        )`,
      [
        DRIZZLE_BASELINE_FINGERPRINT,
        Date.UTC(2026, 7, 26, 20, 3, 44),
        DRIZZLE_BASELINE_NAME,
        new Date().toISOString(),
        DRIZZLE_BASELINE_NAME,
      ],
    );
    await transaction.runAsync('insert into app_meta (key, value) values (?, ?)', [
      DRIZZLE_BASELINE_META_KEY,
      expectedMarker,
    ]);
  });
}
