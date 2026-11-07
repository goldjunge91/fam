import { sql } from 'drizzle-orm';
import { check, index, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import { mirrorColumns } from './mirror-columns';

export const chefConversations = sqliteTable(
  'chef_conversations',
  {
    id: text('id').notNull(),
    householdId: text('household_id').notNull(),
    createdBy: text('created_by'),
    lastActivityAt: text('last_activity_at').notNull(),
    continuedFromId: text('continued_from_id'),
    ...mirrorColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    check(
      'chef_conversations_parent_not_self',
      sql`${table.continuedFromId} is null or ${table.continuedFromId} <> ${table.id}`,
    ),
    index('chef_conversations_household_activity_idx').on(
      table.householdId,
      table.lastActivityAt,
      table.id,
    ),
    index('chef_conversations_household_updated_idx').on(
      table.householdId,
      table.updatedAt,
      table.id,
    ),
  ],
);

export const chefConversationTurns = sqliteTable(
  'chef_conversation_turns',
  {
    id: text('id').notNull(),
    conversationId: text('conversation_id').notNull(),
    householdId: text('household_id').notNull(),
    createdBy: text('created_by'),
    clientRequestId: text('client_request_id').notNull(),
    requestFingerprint: text('request_fingerprint').notNull(),
    userText: text('user_text').notNull(),
    requestPayload: text('request_payload').notNull(),
    responsePayload: text('response_payload').notNull(),
    ...mirrorColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    uniqueIndex('chef_turns_client_request_idx').on(table.clientRequestId),
    index('chef_turns_household_created_idx').on(table.householdId, table.createdAt, table.id),
    index('chef_turns_conversation_created_idx').on(
      table.conversationId,
      table.createdAt,
      table.id,
    ),
    check('chef_turns_user_text_check', sql`length(trim(${table.userText})) between 1 and 8000`),
    check(
      'chef_turns_fingerprint_check',
      sql`length(${table.requestFingerprint}) = 64 and ${table.requestFingerprint} not glob '*[^0-9a-f]*'`,
    ),
  ],
);

export const chefRecipeHistory = sqliteTable(
  'chef_recipe_history',
  {
    id: text('id').notNull(),
    conversationId: text('conversation_id').notNull(),
    turnId: text('turn_id').notNull(),
    householdId: text('household_id').notNull(),
    title: text('title').notNull(),
    recipePayload: text('recipe_payload').notNull(),
    ...mirrorColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    uniqueIndex('chef_recipe_history_turn_idx').on(table.turnId),
    index('chef_recipe_history_household_created_idx').on(
      table.householdId,
      table.createdAt,
      table.id,
    ),
    index('chef_recipe_history_conversation_created_idx').on(
      table.conversationId,
      table.createdAt,
      table.id,
    ),
    check('chef_recipe_history_title_check', sql`length(trim(${table.title})) between 1 and 8000`),
  ],
);
