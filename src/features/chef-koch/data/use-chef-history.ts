import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import {
  getChefConversation,
  getChefRecipeHistory,
  listChefConversations,
  listChefConversationTurns,
  listChefRecipeHistory,
} from '@/features/chef-koch/data/chef-history-repository';
import type { ChefConversation, ChefHistoryCursor } from '@/features/chef-koch/domain/chef-history';
import { getDatabase } from '@/lib/db/local-client';
import { getEncryptedAccountStorage } from '@/lib/storage/local-account-storage';

const CONTINUATION_REJECTION_KEY_PREFIX = 'chef-koch.continuation-rejected.v1';

export type ChefConversationWithContinuationState = ChefConversation & {
  continuationRejected?: true;
};

function continuationRejectionStorageKey(householdId: string, conversationId: string): string {
  return `${CONTINUATION_REJECTION_KEY_PREFIX}.${encodeURIComponent(householdId)}.${encodeURIComponent(conversationId)}`;
}

export async function rememberChefConversationContinuationRejection(
  accountId: string,
  householdId: string,
  conversationId: string,
): Promise<void> {
  const storage = await getEncryptedAccountStorage(accountId);
  storage.set(continuationRejectionStorageKey(householdId, conversationId), 'true');
}

async function isChefConversationContinuationRejected(
  accountId: string,
  householdId: string,
  conversationId: string,
): Promise<boolean> {
  try {
    const storage = await getEncryptedAccountStorage(accountId);
    return (
      storage.getString(continuationRejectionStorageKey(householdId, conversationId)) === 'true'
    );
  } catch {
    return false;
  }
}

export const chefHistoryQueryKey = (householdId: string | null | undefined) =>
  ['chef-history', householdId] as const;

export const chefConversationQueryKey = (
  householdId: string | null | undefined,
  conversationId: string,
  accountId: string | null | undefined,
) =>
  [
    ...chefHistoryQueryKey(householdId),
    'conversation',
    conversationId,
    'account',
    accountId,
  ] as const;

export function useChefConversations(householdId: string | null) {
  return useInfiniteQuery({
    queryKey: [...chefHistoryQueryKey(householdId), 'conversations'],
    enabled: householdId !== null,
    networkMode: 'always',
    initialPageParam: null as ChefHistoryCursor | null,
    queryFn: async ({ pageParam }) => {
      if (householdId === null) return { items: [], nextCursor: null };
      return listChefConversations(await getDatabase(), householdId, pageParam);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    select: (result) => result.pages.flatMap((page) => page.items),
  });
}

export function useChefRecipeHistoryList(householdId: string | null) {
  return useInfiniteQuery({
    queryKey: [...chefHistoryQueryKey(householdId), 'recipes'],
    enabled: householdId !== null,
    networkMode: 'always',
    initialPageParam: null as ChefHistoryCursor | null,
    queryFn: async ({ pageParam }) => {
      if (householdId === null) return { items: [], nextCursor: null };
      return listChefRecipeHistory(await getDatabase(), householdId, pageParam);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    select: (result) => result.pages.flatMap((page) => page.items),
  });
}

export function useChefConversation(
  householdId: string | null,
  conversationId: string,
  accountId: string | null = null,
) {
  return useQuery<ChefConversationWithContinuationState | null>({
    queryKey: chefConversationQueryKey(householdId, conversationId, accountId),
    enabled: householdId !== null && conversationId.length > 0 && accountId !== null,
    networkMode: 'always',
    staleTime: 0,
    queryFn: async () => {
      if (householdId === null || accountId === null) return null;
      const conversation = await getChefConversation(
        await getDatabase(),
        householdId,
        conversationId,
      );
      if (conversation === null) return null;
      const continuationRejected = await isChefConversationContinuationRejected(
        accountId,
        householdId,
        conversationId,
      );
      return continuationRejected ? { ...conversation, continuationRejected: true } : conversation;
    },
  });
}

export function useChefConversationTurns(householdId: string | null, conversationId: string) {
  return useInfiniteQuery({
    queryKey: [...chefHistoryQueryKey(householdId), 'conversation', conversationId, 'turns'],
    enabled: householdId !== null && conversationId.length > 0,
    networkMode: 'always',
    initialPageParam: null as ChefHistoryCursor | null,
    queryFn: async ({ pageParam }) => {
      if (householdId === null) return { items: [], nextCursor: null };
      return listChefConversationTurns(await getDatabase(), householdId, conversationId, pageParam);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    select: (result) => result.pages.flatMap((page) => page.items),
  });
}

export function useChefRecipeHistory(householdId: string | null, recipeHistoryId: string) {
  return useQuery({
    queryKey: [...chefHistoryQueryKey(householdId), 'recipe', recipeHistoryId],
    enabled: householdId !== null && recipeHistoryId.length > 0,
    networkMode: 'always',
    queryFn: async () => {
      if (householdId === null) return null;
      return getChefRecipeHistory(await getDatabase(), householdId, recipeHistoryId);
    },
  });
}
