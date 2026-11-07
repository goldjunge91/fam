import { z } from 'zod';

import {
  CHEF_HISTORY_PAGE_SIZE,
  CHEF_HISTORY_TURN_PAGE_SIZE,
  type ChefConversation,
  type ChefConversationSummary,
  type ChefConversationTurn,
  type ChefConversationTurnView,
  type ChefHistoryCursor,
  type ChefHistoryHydration,
  type ChefHistoryPage,
  type ChefRecipeHistoryRow,
  chefConversationRowSchema,
  chefConversationTurnRowSchema,
  chefHistoryHydrationSchema,
  chefRecipeHistoryRowSchema,
} from '@/features/chef-koch/domain/chef-history';
import type { SqlDatabase, SqlParam } from '@/lib/db/types';
import { upsertMirrorRow } from '@/lib/sync/mirror-write';
import { reportError } from '@/lib/telemetry';

const localConversationSchema = chefConversationRowSchema.omit({ updated_at: true });
const localConversationSummarySchema = localConversationSchema.extend({
  first_user_text: z.string().trim().min(1),
});

type LocalTurnRow = Omit<ChefConversationTurn, 'request_payload' | 'response_payload'> & {
  request_payload: string;
  response_payload: string;
  recipe_history_id: string | null;
};

type LocalRecipeRow = Omit<ChefRecipeHistoryRow, 'recipe_payload'> & {
  recipe_payload: string;
};

function cursorFilter(
  column: 'created_at' | 'last_activity_at',
  cursor: ChefHistoryCursor | null,
  direction: 'asc' | 'desc',
): { sql: string; params: SqlParam[] } {
  if (cursor === null) return { sql: '', params: [] };
  const operator = direction === 'asc' ? '>' : '<';
  return {
    sql: `and (${column} ${operator} ? or (${column} = ? and id ${operator} ?))`,
    params: [cursor.timestamp, cursor.timestamp, cursor.id],
  };
}

function reportCorruptRow(entity: string, rowId: string): void {
  reportError(new Error('Chef-History-Zeile ist ungueltig.'), {
    operation: 'chef_history.local_parse',
    entity,
    entity_id: rowId,
    error_code: 'chef_history_row_invalid',
  });
}

function cursorAfterRawRow(
  rows: readonly Record<string, unknown>[],
  timestampColumn: 'created_at' | 'last_activity_at',
  pageSize: number,
): ChefHistoryCursor | null {
  if (rows.length < pageSize) return null;
  const last = rows.at(-1);
  const timestamp = last?.[timestampColumn];
  const id = last?.id;
  return typeof timestamp === 'string' && typeof id === 'string' ? { timestamp, id } : null;
}

function parseTurn(row: LocalTurnRow): ChefConversationTurnView | null {
  try {
    const { recipe_history_id, ...storedTurn } = row;
    const parsed = chefConversationTurnRowSchema.safeParse({
      ...storedTurn,
      request_payload: JSON.parse(row.request_payload),
      response_payload: JSON.parse(row.response_payload),
    });
    if (parsed.success) return { ...parsed.data, recipe_history_id };
  } catch {
    // Die einzelne Zeile bleibt isoliert; andere History kann weiter laden.
  }
  reportCorruptRow('chef_conversation_turns', row.id);
  return null;
}

function parseRecipe(row: LocalRecipeRow): ChefRecipeHistoryRow | null {
  try {
    const parsed = chefRecipeHistoryRowSchema.safeParse({
      ...row,
      recipe_payload: JSON.parse(row.recipe_payload),
    });
    if (parsed.success) return parsed.data;
  } catch {
    // Die einzelne Zeile bleibt isoliert; andere History kann weiter laden.
  }
  reportCorruptRow('chef_recipe_history', row.id);
  return null;
}

export async function listChefConversations(
  db: SqlDatabase,
  householdId: string,
  cursor: ChefHistoryCursor | null = null,
  limit = CHEF_HISTORY_PAGE_SIZE,
): Promise<ChefHistoryPage<ChefConversationSummary>> {
  const pageSize = Math.max(1, Math.floor(limit));
  const filter = cursorFilter('last_activity_at', cursor, 'desc');
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `select conversation.id,
            conversation.household_id,
            conversation.created_by,
            conversation.created_at,
            conversation.last_activity_at,
            conversation.continued_from_id,
            coalesce((
              select turn.user_text
              from chef_conversation_turns as turn
              where turn.conversation_id = conversation.id
                and turn.household_id = conversation.household_id
              order by turn.created_at asc, turn.id asc
              limit 1
            ), 'Unterhaltung') as first_user_text
       from chef_conversations as conversation
      where conversation.household_id = ?
        ${filter.sql.replaceAll(' id ', ' conversation.id ')}
      order by conversation.last_activity_at desc, conversation.id desc
      limit ?`,
    [householdId, ...filter.params, pageSize],
  );

  const items = rows.flatMap((row) => {
    const parsed = localConversationSummarySchema.safeParse(row);
    if (parsed.success) return [parsed.data];
    reportCorruptRow('chef_conversations', typeof row.id === 'string' ? row.id : 'unknown');
    return [];
  });

  return {
    items,
    nextCursor: cursorAfterRawRow(rows, 'last_activity_at', pageSize),
  };
}

export async function getChefConversation(
  db: SqlDatabase,
  householdId: string,
  conversationId: string,
): Promise<ChefConversation | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `select id, household_id, created_by, created_at, last_activity_at, continued_from_id
       from chef_conversations
      where id = ? and household_id = ?`,
    [conversationId, householdId],
  );
  if (row === null) return null;
  const parsed = localConversationSchema.safeParse(row);
  if (parsed.success) return parsed.data;
  reportCorruptRow('chef_conversations', conversationId);
  return null;
}

export async function listChefConversationTurns(
  db: SqlDatabase,
  householdId: string,
  conversationId: string,
  cursor: ChefHistoryCursor | null = null,
  limit = CHEF_HISTORY_TURN_PAGE_SIZE,
): Promise<ChefHistoryPage<ChefConversationTurnView>> {
  const pageSize = Math.max(1, Math.floor(limit));
  const filter = cursorFilter('created_at', cursor, 'asc');
  const rows = await db.getAllAsync<LocalTurnRow>(
    `select turn.id, turn.conversation_id, turn.household_id, turn.created_by,
            turn.client_request_id, turn.request_fingerprint, turn.user_text,
            turn.request_payload, turn.response_payload, turn.created_at,
            (select recipe.id from chef_recipe_history as recipe
              where recipe.turn_id = turn.id and recipe.household_id = turn.household_id
              limit 1) as recipe_history_id
       from chef_conversation_turns as turn
      where turn.household_id = ? and turn.conversation_id = ?
        ${filter.sql.replaceAll(' id ', ' turn.id ').replaceAll('created_at', 'turn.created_at')}
      order by turn.created_at asc, turn.id asc
      limit ?`,
    [householdId, conversationId, ...filter.params, pageSize],
  );
  const items = rows.flatMap((row) => {
    const parsed = parseTurn(row);
    return parsed === null ? [] : [parsed];
  });
  const last = rows.at(-1);

  return {
    items,
    nextCursor:
      rows.length < pageSize || last === undefined
        ? null
        : { timestamp: last.created_at, id: last.id },
  };
}

export async function listChefRecipeHistory(
  db: SqlDatabase,
  householdId: string,
  cursor: ChefHistoryCursor | null = null,
  limit = CHEF_HISTORY_PAGE_SIZE,
): Promise<ChefHistoryPage<ChefRecipeHistoryRow>> {
  const pageSize = Math.max(1, Math.floor(limit));
  const filter = cursorFilter('created_at', cursor, 'desc');
  const rows = await db.getAllAsync<LocalRecipeRow>(
    `select id, conversation_id, turn_id, household_id, title, recipe_payload, created_at
       from chef_recipe_history
      where household_id = ?
        ${filter.sql}
      order by created_at desc, id desc
      limit ?`,
    [householdId, ...filter.params, pageSize],
  );
  const items = rows.flatMap((row) => {
    const parsed = parseRecipe(row);
    return parsed === null ? [] : [parsed];
  });
  const last = rows.at(-1);

  return {
    items,
    nextCursor:
      rows.length < pageSize || last === undefined
        ? null
        : { timestamp: last.created_at, id: last.id },
  };
}

export async function getChefRecipeHistory(
  db: SqlDatabase,
  householdId: string,
  recipeHistoryId: string,
): Promise<ChefRecipeHistoryRow | null> {
  const row = await db.getFirstAsync<LocalRecipeRow>(
    `select id, conversation_id, turn_id, household_id, title, recipe_payload, created_at
       from chef_recipe_history
      where id = ? and household_id = ?`,
    [recipeHistoryId, householdId],
  );
  return row === null ? null : parseRecipe(row);
}

export async function hydrateChefHistory(
  db: SqlDatabase,
  input: ChefHistoryHydration,
): Promise<ChefHistoryHydration> {
  const hydration = chefHistoryHydrationSchema.parse(input);
  await db.withExclusiveTransactionAsync(async (txn) => {
    await upsertMirrorRow(txn, 'chef_conversations', hydration.conversation, { dirty: 0 });
    await upsertMirrorRow(txn, 'chef_conversation_turns', hydration.turn, { dirty: 0 });
    for (const recipe of hydration.recipe_history) {
      await upsertMirrorRow(txn, 'chef_recipe_history', recipe, { dirty: 0 });
    }
  });
  return hydration;
}
