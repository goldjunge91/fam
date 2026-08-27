import { integer, text } from 'drizzle-orm/sqlite-core';

const dirty = () => integer('_dirty', { mode: 'boolean' }).notNull().default(false);

export const mirrorColumns = () => ({
  createdAt: text('created_at'),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
  dirty: dirty(),
});
