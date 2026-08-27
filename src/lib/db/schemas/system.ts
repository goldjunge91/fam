import { sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const outbox = sqliteTable(
  'outbox',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entity: text('entity').notNull(),
    entityId: text('entity_id').notNull(),
    op: text('op').notNull(),
    payload: text('payload').notNull(),
    createdAt: integer('created_at').notNull(),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    nextAttemptAt: integer('next_attempt_at').notNull().default(0),
  },
  (table) => [
    check('outbox_op_check', sql`${table.op} in ('insert', 'update', 'delete', 'restore')`),
    index('outbox_row_idx').on(table.entity, table.entityId, table.id),
    index('outbox_due_idx').on(table.nextAttemptAt, table.id),
  ],
);

export const syncState = sqliteTable(
  'sync_state',
  {
    entity: text('entity').notNull(),
    scope: text('scope').notNull().default('default'),
    lastSyncedAt: text('last_synced_at'),
    lastSyncedId: text('last_synced_id'),
    lastRunAt: integer('last_run_at'),
    lastError: text('last_error'),
  },
  (table) => [primaryKey({ columns: [table.entity, table.scope] })],
);

export const appMeta = sqliteTable(
  'app_meta',
  {
    key: text('key').notNull(),
    value: text('value'),
  },
  (table) => [primaryKey({ columns: [table.key] })],
);
