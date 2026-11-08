import { getEncryptedAccountStorage } from '@/lib/storage/local-account-storage';
import type { AiConsentRecord, AssistantProposal, AssistantThread } from '../types';

const THREADS_KEY = 'ai-assistant.threads.v1';
const CONSENT_KEY = 'ai-assistant.consent.v1';
const MAX_THREADS = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
          typeof meal.date === 'string' &&
          ['breakfast', 'lunch', 'dinner'].includes(String(meal.mealSlot)) &&
          typeof meal.recipeId === 'string' &&
          typeof meal.recipeTitle === 'string' &&
          typeof meal.recipeUpdatedAt === 'string' &&
          typeof meal.portions === 'number' &&
          Number.isInteger(meal.portions) &&
          typeof meal.rationale === 'string',
      )
    );
  }
  return (
    value.kind === 'ingredient_swap_proposal.v1' &&
    (typeof value.foodRulesUpdatedAt === 'string' || value.foodRulesUpdatedAt === null) &&
    typeof value.recipeId === 'string' &&
    typeof value.recipeTitle === 'string' &&
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
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    Array.isArray(value.messages) &&
    value.messages.every(
      (message) =>
        isRecord(message) &&
        typeof message.id === 'string' &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.text === 'string' &&
        typeof message.createdAt === 'string' &&
        (message.proposals === undefined ||
          (Array.isArray(message.proposals) && message.proposals.every(isAssistantProposal))) &&
        (message.toolTrace === undefined ||
          (Array.isArray(message.toolTrace) &&
            message.toolTrace.every((tool) =>
              [
                'search_recipes',
                'get_inventory',
                'propose_meal_plan',
                'suggest_ingredient_swap',
              ].includes(String(tool)),
            ))) &&
        (message.suggestions === undefined ||
          (Array.isArray(message.suggestions) &&
            message.suggestions.every((suggestion) => typeof suggestion === 'string'))),
    )
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

export async function loadAiConsent(userId: string): Promise<AiConsentRecord | null> {
  const storage = await getEncryptedAccountStorage(userId);
  const stored = storage.getString(CONSENT_KEY);
  if (!stored) return null;

  try {
    const parsed: unknown = JSON.parse(stored);
    if (
      isRecord(parsed) &&
      parsed.version === 'fam-ai-v2' &&
      typeof parsed.acceptedAt === 'string'
    ) {
      return parsed as AiConsentRecord;
    }
  } catch {
    return null;
  }
  return null;
}

export async function saveAiConsent(userId: string, record: AiConsentRecord): Promise<void> {
  const storage = await getEncryptedAccountStorage(userId);
  storage.set(CONSENT_KEY, JSON.stringify(record));
}

export async function revokeAiConsent(userId: string): Promise<void> {
  const storage = await getEncryptedAccountStorage(userId);
  storage.remove(CONSENT_KEY);
}
