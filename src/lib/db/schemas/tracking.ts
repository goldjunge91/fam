import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
