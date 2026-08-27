import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { mirrorColumns } from './mirror-columns';

export const mealPlans = sqliteTable(
  'meal_plans',
  {
    id: text('id').notNull(),
    householdId: text('household_id').notNull(),
    name: text('name').notNull(),
    weekStartDate: text('week_start_date').notNull(),
    createdBy: text('created_by'),
    ...mirrorColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('meal_plans_hh_idx').on(table.householdId, table.deletedAt),
    index('meal_plans_week_idx').on(table.householdId, table.weekStartDate),
    index('meal_plans_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);

export const mealPlanEntries = sqliteTable(
  'meal_plan_entries',
  {
    id: text('id').notNull(),
    mealPlanId: text('meal_plan_id').notNull(),
    householdId: text('household_id').notNull(),
    recipeId: text('recipe_id').notNull(),
    entryDate: text('entry_date').notNull(),
    mealSlot: text('meal_slot').notNull(),
    servingsMode: text('servings_mode').notNull().default('portions'),
    portions: real('portions').notNull(),
    peopleCount: integer('people_count'),
    createdBy: text('created_by'),
    ...mirrorColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('meal_plan_entries_plan_idx').on(table.mealPlanId, table.deletedAt),
    index('meal_plan_entries_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);
