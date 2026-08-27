import { sql } from 'drizzle-orm';
import { check, index, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { mirrorColumns } from './mirror-columns';

export const products = sqliteTable(
  'products',
  {
    id: text('id').notNull(),
    barcode: text('barcode'),
    name: text('name').notNull(),
    brand: text('brand'),
    kcalPer100: real('kcal_per_100'),
    proteinGPer100: real('protein_g_per_100'),
    carbsGPer100: real('carbs_g_per_100'),
    fatGPer100: real('fat_g_per_100'),
    fiberGPer100: real('fiber_g_per_100'),
    sugarGPer100: real('sugar_g_per_100'),
    saltGPer100: real('salt_g_per_100'),
    servingSizeG: real('serving_size_g'),
    offCategoryTags: text('off_category_tags').default('[]'),
    offLastModifiedAt: text('off_last_modified_at'),
    source: text('source').notNull().default('manual'),
    createdBy: text('created_by'),
    ...mirrorColumns(),
  },
  (table) => [primaryKey({ columns: [table.id] }), index('products_barcode_idx').on(table.barcode)],
);

export const productUsage = sqliteTable(
  'product_usage',
  {
    id: text('id').notNull(),
    userId: text('user_id').notNull(),
    householdId: text('household_id'),
    feature: text('feature').notNull(),
    mealType: text('meal_type'),
    productId: text('product_id'),
    name: text('name').notNull(),
    brand: text('brand'),
    barcode: text('barcode'),
    unit: text('unit'),
    quantity: real('quantity'),
    kcal: real('kcal'),
    proteinG: real('protein_g'),
    carbsG: real('carbs_g'),
    fatG: real('fat_g'),
    usedAt: text('used_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    check(
      'product_usage_feature_check',
      sql`${table.feature} in ('fridge', 'shopping_list', 'diary')`,
    ),
    check(
      'product_usage_meal_type_check',
      sql`${table.mealType} in ('breakfast', 'lunch', 'dinner', 'snack')`,
    ),
    index('product_usage_lookup_idx').on(table.userId, table.feature, table.mealType, table.usedAt),
  ],
);
