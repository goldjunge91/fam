import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import { mirrorColumns } from './mirror-columns';

export const storageLocations = sqliteTable(
  'storage_locations',
  {
    id: text('id').notNull(),
    householdId: text('household_id').notNull(),
    name: text('name').notNull(),
    kind: text('kind').notNull().default('pantry'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...mirrorColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    check('storage_locations_name_check', sql`length(trim(${table.name})) between 1 and 60`),
    check(
      'storage_locations_kind_check',
      sql`${table.kind} in ('fridge', 'freezer', 'pantry', 'custom')`,
    ),
    index('storage_locations_hh_idx').on(table.householdId, table.deletedAt),
    index('storage_locations_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);

export const fridgeItems = sqliteTable(
  'fridge_items',
  {
    id: text('id').notNull(),
    householdId: text('household_id').notNull(),
    productId: text('product_id'),
    name: text('name').notNull(),
    quantity: real('quantity').notNull().default(1),
    unit: text('unit').notNull().default('piece'),
    packageSize: real('package_size'),
    packageSizeUnit: text('package_size_unit'),
    locationId: text('location_id').notNull(),
    expiryDate: text('expiry_date'),
    openedAt: text('opened_at'),
    vacuumSealed: integer('vacuum_sealed', { mode: 'boolean' }).notNull().default(false),
    expiryUserSet: integer('expiry_user_set', { mode: 'boolean' }).notNull().default(false),
    addedBy: text('added_by'),
    ...mirrorColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    check('fridge_items_name_check', sql`length(trim(${table.name})) between 1 and 200`),
    check('fridge_items_unit_check', sql`length(trim(${table.unit})) > 0`),
    check(
      'fridge_items_quantity_check',
      sql`${table.quantity} >= 0
        and ${table.quantity} <= 9999999.9
        and ${table.quantity} * 10 = cast(${table.quantity} * 10 as integer)`,
    ),
    check(
      'fridge_items_quantity_lifecycle_check',
      sql`(${table.deletedAt} is null and ${table.quantity} > 0)
        or (${table.deletedAt} is not null and ${table.quantity} = 0)`,
    ),
    check(
      'fridge_items_package_size_check',
      sql`${table.packageSize} is null or (
        ${table.packageSize} > 0
        and ${table.packageSize} <= 9999999.9
        and ${table.packageSize} * 10 = cast(${table.packageSize} * 10 as integer)
      )`,
    ),
    check(
      'fridge_items_package_size_unit_check',
      sql`(${table.packageSize} is null and ${table.packageSizeUnit} is null)
        or (${table.packageSize} is not null
          and ${table.packageSizeUnit} is not null
          and length(trim(${table.packageSizeUnit})) > 0)`,
    ),
    index('fridge_items_hh_idx').on(table.householdId, table.deletedAt),
    index('fridge_items_location_idx').on(table.locationId, table.deletedAt),
    index('fridge_items_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').notNull(),
    operationId: text('operation_id').notNull(),
    operationPayloadHash: text('operation_payload_hash'),
    householdId: text('household_id').notNull(),
    fridgeItemId: text('fridge_item_id').notNull(),
    productId: text('product_id'),
    actor: text('actor'),
    type: text('type').notNull(),
    quantity: real('quantity').notNull(),
    unit: text('unit').notNull().default('piece'),
    locationId: text('location_id').notNull(),
    reason: text('reason'),
    notes: text('notes'),
    reversalOf: text('reversal_of'),
    ...mirrorColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    check('transactions_type_check', sql`${table.type} in ('in', 'out', 'waste')`),
    check('transactions_unit_check', sql`length(trim(${table.unit})) > 0`),
    check('transactions_notes_check', sql`${table.notes} is null or length(${table.notes}) <= 500`),
    check(
      'transactions_quantity_check',
      sql`${table.quantity} > 0
        and ${table.quantity} <= 9999999.9
        and ${table.quantity} * 10 = cast(${table.quantity} * 10 as integer)`,
    ),
    check(
      'transactions_reason_check',
      sql`(${table.type} <> 'waste' and ${table.reason} is null)
        or (${table.type} = 'waste' and ${table.reason} is not null
          and ${table.reason} in ('expired', 'spoiled', 'other'))`,
    ),
    uniqueIndex('transactions_operation_type_idx').on(table.operationId, table.type),
    uniqueIndex('transactions_reversal_idx')
      .on(table.reversalOf)
      .where(sql`${table.reversalOf} is not null`),
    index('transactions_hh_idx').on(table.householdId, table.updatedAt, table.id),
    index('transactions_item_idx').on(table.fridgeItemId, table.updatedAt),
    index('transactions_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);
