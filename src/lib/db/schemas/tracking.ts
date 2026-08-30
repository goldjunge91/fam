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

export const medicationLogs = sqliteTable(
  'medication_logs',
  {
    id: text('id').notNull(),
    userId: text('user_id').notNull(),
    childProfileId: text('child_profile_id'),
    medicationName: text('medication_name').notNull(),
    dose: real('dose'),
    unit: text('unit').notNull().default('mg'),
    injectionSite: text('injection_site'),
    administeredAt: text('administered_at').notNull(),
    notes: text('notes'),
    ...mirrorColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('medication_logs_user_time_idx').on(table.userId, table.administeredAt),
    index('medication_logs_child_idx').on(table.childProfileId),
    index('medication_logs_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);

export const symptomLogs = sqliteTable(
  'symptom_logs',
  {
    id: text('id').notNull(),
    userId: text('user_id').notNull(),
    childProfileId: text('child_profile_id'),
    loggedAt: text('logged_at').notNull(),
    appetiteLevel: integer('appetite_level'),
    satietyLevel: integer('satiety_level'),
    nauseaLevel: integer('nausea_level'),
    sideEffects: text('side_effects').notNull().default('[]'),
    notes: text('notes'),
    ...mirrorColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('symptom_logs_user_time_idx').on(table.userId, table.loggedAt),
    index('symptom_logs_child_idx').on(table.childProfileId),
    index('symptom_logs_dirty_idx').on(table.dirty).where(sql`${table.dirty} = 1`),
  ],
);

export const injectionPlans = sqliteTable(
  'injection_plans',
  {
    id: text('id').notNull(),
    userId: text('user_id').notNull(),
    medicationName: text('medication_name').notNull(),
    dose: real('dose').notNull(),
    unit: text('unit').notNull().default('mg'),
    cadenceDays: integer('cadence_days').notNull(),
    anchorAt: text('anchor_at').notNull(),
    reminderEnabled: integer('reminder_enabled', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    check(
      'injection_plans_medication_name_check',
      sql`length(trim(${table.medicationName})) between 1 and 200`,
    ),
    check('injection_plans_dose_check', sql`${table.dose} > 0`),
    check(
      'injection_plans_unit_check',
      sql`${table.unit} in ('mg', 'ml', 'units', 'mcg', 'pills')`,
    ),
    check('injection_plans_cadence_days_check', sql`${table.cadenceDays} > 0`),
    uniqueIndex('injection_plans_user_id_idx').on(table.userId),
  ],
);
