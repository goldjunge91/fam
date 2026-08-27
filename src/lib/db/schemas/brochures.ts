import { sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { mirrorColumns } from './mirror-columns';

export const localBrochureStores = sqliteTable(
  'local_brochure_stores',
  {
    id: text('id').notNull(),
    name: text('name').notNull(),
    logoUrl: text('logo_url'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [primaryKey({ columns: [table.id] })],
);

export const localBrochures = sqliteTable(
  'local_brochures',
  {
    id: text('id').notNull(),
    storeId: text('store_id').notNull(),
    title: text('title').notNull(),
    validFrom: text('valid_from').notNull(),
    validUntil: text('valid_until').notNull(),
    coverImage: text('cover_image').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('local_brochures_store_idx').on(table.storeId),
  ],
);

export const localBrochurePages = sqliteTable(
  'local_brochure_pages',
  {
    id: text('id').notNull(),
    brochureId: text('brochure_id').notNull(),
    pageNumber: integer('page_number').notNull(),
    imageUrl: text('image_url').notNull(),
    hotspotsJson: text('hotspots_json').notNull().default('[]'),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('local_brochure_pages_brochure_idx').on(table.brochureId, table.pageNumber),
  ],
);

export const favoriteBrochureStores = sqliteTable(
  'favorite_brochure_stores',
  {
    id: text('id').notNull(),
    userId: text('user_id').notNull(),
    storeId: text('store_id').notNull(),
    ...mirrorColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('favorite_brochure_stores_user_idx').on(table.userId, table.deletedAt),
    index('favorite_brochure_stores_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);

export const localBrochureCache = sqliteTable(
  'local_brochure_cache',
  {
    id: integer('id').notNull(),
    zipCode: text('zip_code').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    check('local_brochure_cache_single_row_check', sql`${table.id} = 1`),
  ],
);
