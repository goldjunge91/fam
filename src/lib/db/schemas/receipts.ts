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

export const receipts = sqliteTable(
  'purchase_receipts',
  {
    id: text('id').notNull(),
    householdId: text('household_id').notNull(),
    storeId: text('store_id'),
    purchaseDate: text('purchase_date'),
    currency: text('currency').notNull().default('EUR'),
    totalCents: integer('total_cents'),
    processingStatus: text('processing_status').notNull().default('draft'),
    createdBy: text('created_by'),
    confirmedBy: text('confirmed_by'),
    confirmedAt: text('confirmed_at'),
    ...mirrorColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    check('receipts_currency_check', sql`${table.currency} = 'EUR'`),
    check(
      'receipts_total_cents_check',
      sql`${table.totalCents} is null or ${table.totalCents} >= 0`,
    ),
    check(
      'receipts_processing_status_check',
      sql`${table.processingStatus} in ('draft', 'processing', 'needs_review', 'confirmed', 'failed')`,
    ),
    index('receipts_hh_idx').on(table.householdId, table.deletedAt),
    index('receipts_store_idx').on(table.storeId),
    index('receipts_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);

export const receiptItems = sqliteTable(
  'purchase_receipt_items',
  {
    id: text('id').notNull(),
    receiptId: text('receipt_id').notNull(),
    householdId: text('household_id').notNull(),
    position: integer('position').notNull(),
    name: text('name').notNull(),
    productId: text('product_id'),
    categoryId: text('category_id'),
    quantity: real('quantity'),
    unit: text('unit'),
    packageSize: real('package_size'),
    packageSizeUnit: text('package_size_unit'),
    lineTotalCents: integer('line_total_cents'),
    reviewStatus: text('review_status').notNull().default('needs_review'),
    ...mirrorColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    check('receipt_items_position_check', sql`${table.position} >= 0`),
    check('receipt_items_quantity_check', sql`${table.quantity} is null or ${table.quantity} > 0`),
    check(
      'receipt_items_package_size_check',
      sql`${table.packageSize} is null or ${table.packageSize} > 0`,
    ),
    check(
      'receipt_items_line_total_cents_check',
      sql`${table.lineTotalCents} is null or ${table.lineTotalCents} >= 0`,
    ),
    check(
      'receipt_items_review_status_check',
      sql`${table.reviewStatus} in ('needs_review', 'confirmed')`,
    ),
    index('receipt_items_receipt_idx').on(table.receiptId, table.position, table.deletedAt),
    index('receipt_items_hh_idx').on(table.householdId, table.deletedAt),
    index('receipt_items_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);
