import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { mirrorColumns } from './mirror-columns';

export const households = sqliteTable(
  'households',
  {
    id: text('id').notNull(),
    name: text('name').notNull(),
    createdBy: text('created_by'),
    ...mirrorColumns(),
    premiumActive: integer('premium_active', { mode: 'boolean' }).notNull().default(false),
    premiumExpiresAt: text('premium_expires_at'),
    premiumUpdatedAt: text('premium_updated_at'),
  },
  (table) => [primaryKey({ columns: [table.id] })],
);
