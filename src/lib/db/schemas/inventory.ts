import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

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
    openedAt: text('opened_at'),
    vacuumSealed: integer('vacuum_sealed', { mode: 'boolean' }).notNull().default(false),
    expiryUserSet: integer('expiry_user_set', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('fridge_items_hh_idx').on(table.householdId, table.deletedAt),
    index('fridge_items_loc_idx').on(table.locationId),
    index('fridge_items_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').notNull(),
    householdId: text('household_id').notNull(),
    fridgeItemId: text('fridge_item_id'),
    productId: text('product_id'),
    actor: text('actor'),
    type: text('type').notNull(),
    quantity: real('quantity').notNull(),
    locationId: text('location_id'),
    reason: text('reason'),
    previousExpiryDate: text('previous_expiry_date'),
    notes: text('notes'),
    undone: integer('undone', { mode: 'boolean' }).notNull().default(false),
    ...mirrorColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    check('transactions_type_check', sql`${table.type} in ('in', 'out', 'waste', 'open')`),
    check('transactions_quantity_check', sql`${table.quantity} > 0`),
    check(
      'transactions_reason_matches_waste',
      sql`(${table.type} = 'waste') = (${table.reason} is not null)`,
    ),
    check(
      'transactions_previous_expiry_only_for_open',
      sql`${table.previousExpiryDate} is null or ${table.type} = 'open'`,
    ),
    check(
      'transactions_notes_length_check',
      sql`${table.notes} is null or length(${table.notes}) <= 500`,
    ),
    index('transactions_hh_idx').on(table.householdId, table.createdAt),
    index('transactions_fridge_item_idx').on(table.fridgeItemId),
    index('transactions_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);
