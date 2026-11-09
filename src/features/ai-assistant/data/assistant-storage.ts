import { getEncryptedAccountStorage } from '@/lib/storage/local-account-storage';
import type {
  AssistantAttachmentMetadata,
  AssistantPageContext,
  AssistantProposal,
  AssistantThread,
} from '../types';

const THREADS_KEY = 'ai-assistant.threads.v1';
const MAX_THREADS = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isAssistantPageContext(value: unknown): value is AssistantPageContext {
  if (!isRecord(value)) return false;
  if (value.kind === 'recipe') {
    return (
      Object.keys(value).length === 2 &&
      typeof value.recipeId === 'string' &&
      value.recipeId.trim().length > 0 &&
      value.recipeId.length <= 128
    );
  }
  return (
    value.kind === 'meal_plan' &&
    Object.keys(value).length === 2 &&
    isValidIsoDate(value.weekStartDate)
  );
}

function isAssistantAttachmentMetadata(value: unknown): value is AssistantAttachmentMetadata {
  return (
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    typeof value.filename === 'string' &&
    value.filename.trim().length > 0 &&
    value.filename.length <= 100 &&
    ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(String(value.mimeType))
  );
}

function isAssistantProposal(value: unknown): value is AssistantProposal {
  if (!isRecord(value)) return false;
  if (value.kind === 'meal_plan_proposal.v1') {
    return (
      (typeof value.foodRulesUpdatedAt === 'string' || value.foodRulesUpdatedAt === null) &&
      typeof value.safetyNote === 'string' &&
      Array.isArray(value.meals) &&
      value.meals.length > 0 &&
      value.meals.length <= 7 &&
      value.meals.every(
        (meal) =>
          isRecord(meal) &&
          isValidIsoDate(meal.date) &&
          ['breakfast', 'lunch', 'dinner'].includes(String(meal.mealSlot)) &&
          typeof meal.recipeId === 'string' &&
          typeof meal.recipeTitle === 'string' &&
          typeof meal.recipeUpdatedAt === 'string' &&
          typeof meal.portions === 'number' &&
          Number.isInteger(meal.portions) &&
          meal.portions >= 1 &&
          meal.portions <= 12 &&
          typeof meal.rationale === 'string',
      )
    );
  }
  if (value.kind === 'shopping_list_proposal.v1') {
    return (
      typeof value.summary === 'string' &&
      value.summary.trim().length > 0 &&
      value.summary.trim().length <= 280 &&
      Array.isArray(value.items) &&
      value.items.length > 0 &&
      value.items.length <= 40 &&
      value.items.every(
        (item) =>
          isRecord(item) &&
          Object.keys(item).length === 4 &&
          typeof item.name === 'string' &&
          item.name.trim().length > 0 &&
          item.name.trim().length <= 200 &&
          typeof item.quantity === 'number' &&
          Number.isFinite(item.quantity) &&
          item.quantity > 0 &&
          item.quantity <= 1_000 &&
          Math.abs(Math.round(item.quantity * 1_000) - item.quantity * 1_000) < 1e-8 &&
          ['g', 'kg', 'ml', 'l', 'piece', 'package', 'portion'].includes(String(item.unit)) &&
          ['clear', 'unknown'].includes(String(item.foodRuleStatus)),
      )
    );
  }
  if (value.kind === 'shopping_list_item_proposal.v1') {
    return (
      typeof value.name === 'string' &&
      value.name.trim().length > 0 &&
      value.name.trim().length <= 200 &&
      typeof value.quantity === 'number' &&
      Number.isFinite(value.quantity) &&
      value.quantity > 0 &&
      value.quantity <= 1_000 &&
      Math.abs(Math.round(value.quantity * 1_000) - value.quantity * 1_000) < 1e-8 &&
      ['g', 'kg', 'ml', 'l', 'piece', 'package', 'portion'].includes(String(value.unit)) &&
      ['clear', 'unknown'].includes(String(value.foodRuleStatus))
    );
  }
  return (
    value.kind === 'ingredient_swap_proposal.v1' &&
    (typeof value.foodRulesUpdatedAt === 'string' || value.foodRulesUpdatedAt === null) &&
    typeof value.recipeId === 'string' &&
    typeof value.recipeTitle === 'string' &&
    (value.ingredientItemId === undefined ||
      (typeof value.ingredientItemId === 'string' &&
        value.ingredientItemId.trim().length > 0 &&
        value.ingredientItemId.length <= 128)) &&
    typeof value.ingredientName === 'string' &&
    typeof value.replacement === 'string' &&
    typeof value.rationale === 'string' &&
    typeof value.safetyNote === 'string'
  );
}

function isAssistantThread(value: unknown): value is AssistantThread {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.model === 'string' &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt) &&
    Array.isArray(value.messages) &&
    value.messages.every((message) => {
      if (!isRecord(message)) return false;
      const proposalCount = Array.isArray(message.proposals) ? message.proposals.length : -1;
      return (
        typeof message.id === 'string' &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.text === 'string' &&
        typeof message.createdAt === 'string' &&
        (message.attachments === undefined ||
          (Array.isArray(message.attachments) &&
            message.attachments.length > 0 &&
            message.attachments.length <= 5 &&
            message.attachments.every(isAssistantAttachmentMetadata))) &&
        (message.pageContext === undefined || isAssistantPageContext(message.pageContext)) &&
        (message.proposals === undefined ||
          (Array.isArray(message.proposals) && message.proposals.every(isAssistantProposal))) &&
        (message.toolTrace === undefined ||
          (Array.isArray(message.toolTrace) &&
            message.toolTrace.every((tool) =>
              [
                'search_recipes',
                'get_inventory',
                'get_shopping_list',
                'propose_meal_plan',
                'suggest_ingredient_swap',
                'propose_shopping_list_item',
                'propose_shopping_list_items',
              ].includes(String(tool)),
            ))) &&
        (message.appliedProposalIndexes === undefined ||
          (Array.isArray(message.appliedProposalIndexes) &&
            Array.isArray(message.proposals) &&
            message.appliedProposalIndexes.length <= message.proposals.length &&
            message.appliedProposalIndexes.every(
              (index) =>
                typeof index === 'number' &&
                Number.isInteger(index) &&
                index >= 0 &&
                index < proposalCount,
            ) &&
            new Set(message.appliedProposalIndexes).size ===
              message.appliedProposalIndexes.length)) &&
        (message.suggestions === undefined ||
          (Array.isArray(message.suggestions) &&
            message.suggestions.every((suggestion) => typeof suggestion === 'string')))
      );
    })
  );
}

export async function loadAssistantThreads(userId: string): Promise<AssistantThread[]> {
  const storage = await getEncryptedAccountStorage(userId);
  const stored = storage.getString(THREADS_KEY);
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAssistantThread).slice(0, MAX_THREADS);
  } catch {
    return [];
  }
}

export async function saveAssistantThreads(
  userId: string,
  threads: readonly AssistantThread[],
): Promise<void> {
  const storage = await getEncryptedAccountStorage(userId);
  storage.set(
    THREADS_KEY,
    JSON.stringify(
      [...threads]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, MAX_THREADS),
    ),
  );
}
