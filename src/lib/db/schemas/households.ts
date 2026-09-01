import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { mirrorColumns } from './mirror-columns';

export const households = sqliteTable(
  'households',
  {
    id: text('id').notNull(),
    name: text('name').notNull(),
    createdBy: text('created_by'),
    ...mirrorColumns(),
    plusActive: integer('plus_active', { mode: 'boolean' }).notNull().default(false),
    plusExpiresAt: text('plus_expires_at'),
    plusUpdatedAt: text('plus_updated_at'),
    aiActive: integer('ai_active', { mode: 'boolean' }).notNull().default(false),
    aiExpiresAt: text('ai_expires_at'),
    aiUpdatedAt: text('ai_updated_at'),
    aiSubscriberId: text('ai_subscriber_id'),
  },
  (table) => [primaryKey({ columns: [table.id] })],
);
