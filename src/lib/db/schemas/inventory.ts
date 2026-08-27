import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { mirrorColumns } from './mirror-columns';

export const storageLocations = sqliteTable(
  'storage_locations',
  {
    id: text('id').notNull(),
    householdId: text('household_id').notNull(),
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...mirrorColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('storage_locations_hh_idx').on(table.householdId, table.sortOrder),
    index('storage_locations_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);

export const fridgeItems = sqliteTable(
  'fridge_items',
  {
    id: text('id').notNull(),
    householdId: text('household_id').notNull(),
    locationId: text('location_id'),
    productId: text('product_id'),
    name: text('name').notNull(),
    quantity: real('quantity').notNull().default(1),
    unit: text('unit').notNull().default('piece'),
    expiryDate: text('expiry_date'),
    addedBy: text('added_by'),
    ...mirrorColumns(),
    packageSize: real('package_size'),
    packageSizeUnit: text('package_size_unit'),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('fridge_items_hh_idx').on(table.householdId, table.deletedAt),
    index('fridge_items_loc_idx').on(table.locationId),
    index('fridge_items_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);
