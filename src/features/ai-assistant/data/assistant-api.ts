import { getSupabase } from '@/lib/backend/supabase/remote-client';
import type {
  AiCreditStatus,
  AssistantHistoryMessage,
  AssistantProposal,
  AssistantReply,
  AssistantToolName,
} from '../types';
import { AI_CONSENT_VERSION } from '../types';

type SendAssistantMessageInput = {
  householdId: string;
  model: string;
  message: string;
  history: readonly AssistantHistoryMessage[];
  includeHouseholdContext: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAiCreditStatus(value: unknown): value is AiCreditStatus {
  return (
    isRecord(value) &&
    Number.isInteger(value.creditsUsed) &&
    Number.isInteger(value.creditsRemaining) &&
    Number.isInteger(value.creditLimit) &&
    typeof value.warningReached === 'boolean' &&
    typeof value.blocked === 'boolean'
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
          typeof meal.date === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(meal.date) &&
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

const ASSISTANT_TOOL_NAMES: AssistantToolName[] = [
  'search_recipes',
  'get_inventory',
  'propose_meal_plan',
  'suggest_ingredient_swap',
];

async function getGatewayErrorCode(error: unknown, data: unknown): Promise<string | null> {
  if (isRecord(data) && typeof data.error === 'string') return data.error;
  if (!isRecord(error) || !(error.context instanceof Response)) return null;
  try {
    const body: unknown = await error.context.clone().json();
    return isRecord(body) && typeof body.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}

function parseAssistantReply(value: unknown): AssistantReply {
  if (
    !isRecord(value) ||
    value.skill !== 'fam-assistant' ||
    typeof value.requestId !== 'string' ||
    typeof value.model !== 'string' ||
    !isRecord(value.result) ||
    value.result.kind !== 'assistant_reply.v1' ||
    typeof value.result.text !== 'string' ||
    !Array.isArray(value.result.suggestions) ||
    !value.result.suggestions.every((suggestion) => typeof suggestion === 'string') ||
    !Array.isArray(value.result.proposals) ||
    !value.result.proposals.every(isAssistantProposal) ||
    !Array.isArray(value.result.toolTrace) ||
    !value.result.toolTrace.every((tool) =>
      ASSISTANT_TOOL_NAMES.includes(tool as AssistantToolName),
    )
  ) {
    throw new Error('Die Antwort des Assistant hatte ein ungültiges Format.');
  }

  const usage = isRecord(value.usage) ? value.usage : undefined;
  const totalTokens = typeof usage?.total_tokens === 'number' ? usage.total_tokens : undefined;
  const cost = typeof usage?.cost === 'number' ? usage.cost : undefined;
  return {
    requestId: value.requestId,
    skill: 'fam-assistant',
    model: value.model,
    result: {
      kind: 'assistant_reply.v1',
      text: value.result.text,
      suggestions: value.result.suggestions,
      proposals: value.result.proposals,
      toolTrace: value.result.toolTrace as AssistantToolName[],
    },
    ...(totalTokens === undefined && cost === undefined
      ? {}
      : { usage: { total_tokens: totalTokens, cost } }),
  };
}

export async function sendAssistantMessage(
  input: SendAssistantMessageInput,
): Promise<AssistantReply> {
  const { data, error } = await getSupabase().functions.invoke('ai-gateway', {
    body: {
      skill: 'fam-assistant',
      householdId: input.householdId,
      model: input.model,
      consentVersion: AI_CONSENT_VERSION,
      message: input.message,
      history: input.history.slice(-12),
      includeHouseholdContext: input.includeHouseholdContext,
    },
  });

  if (error) {
    const code = await getGatewayErrorCode(error, data);
    if (code === 'ai_subscription_required') {
      throw new Error('Für den Assistant brauchst du das AI-Abo dieses Haushalts.');
    }
    if (code === 'ai_credit_limit_exceeded') {
      throw new Error('Das monatliche AI-Credit-Limit ist erreicht.');
    }
    if (code === 'model_not_allowed') {
      throw new Error('Dieses AI-Modell ist derzeit nicht verfügbar.');
    }
    if (code === 'provider_invalid_json') {
      throw new Error('Die KI-Antwort ließ sich nicht verarbeiten. Bitte versuche es erneut.');
    }
    throw new Error(error.message);
  }
  return parseAssistantReply(data);
}

export async function getAiCreditStatus(householdId: string): Promise<AiCreditStatus> {
  const { data, error } = await getSupabase().functions.invoke('ai-gateway', {
    body: { skill: 'fam-ai-credit-status', householdId },
  });
  if (error) {
    const code = await getGatewayErrorCode(error, data);
    throw new Error(code ?? error.message);
  }
  if (!isRecord(data) || data.skill !== 'fam-ai-credit-status' || !isAiCreditStatus(data.status)) {
    throw new Error('Das AI-Guthaben ist nicht verfügbar.');
  }
  return data.status;
}

export async function getOwnFoodRulesUpdatedAt(): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from('profile_food_rules')
    .select('updated_at')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.updated_at ?? null;
}
