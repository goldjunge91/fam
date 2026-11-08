import { getSupabase } from '@/lib/backend/supabase/remote-client';
import type { AiProvider } from '../model-catalog';
import type {
  AiCreditStatus,
  AssistantHistoryMessage,
  AssistantProposal,
  AssistantProposalFoodRuleCoverage,
  AssistantReply,
  AssistantToolName,
} from '../types';
import { AI_CONSENT_VERSION } from '../types';
import { getDevAiModelSelection } from './dev-ai-model-selection';

type SendAssistantMessageInput = {
  householdId: string;
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

function isProposalFoodRuleCoverage(value: unknown): value is AssistantProposalFoodRuleCoverage {
  return (
    isRecord(value) &&
    value.status === 'clear' &&
    (typeof value.rulesUpdatedAt === 'string' || value.rulesUpdatedAt === null) &&
    Array.isArray(value.recipeVersions) &&
    value.recipeVersions.length > 0 &&
    value.recipeVersions.length <= 7 &&
    value.recipeVersions.every(
      (version) =>
        isRecord(version) &&
        typeof version.recipeId === 'string' &&
        version.recipeId.length > 0 &&
        typeof version.recipeUpdatedAt === 'string' &&
        version.recipeUpdatedAt.length > 0 &&
        typeof version.coverageVersion === 'string' &&
        version.coverageVersion.length > 0,
    )
  );
}

function isAssistantProposal(value: unknown): value is AssistantProposal {
  if (!isRecord(value)) return false;
  if (value.kind === 'meal_plan_proposal.v1') {
    const recipeIds = Array.isArray(value.meals)
      ? new Set(value.meals.filter(isRecord).map((meal) => meal.recipeId))
      : new Set<unknown>();
    const coverage = value.foodRuleCoverage;
    return (
      (typeof value.foodRulesUpdatedAt === 'string' || value.foodRulesUpdatedAt === null) &&
      isProposalFoodRuleCoverage(coverage) &&
      coverage.rulesUpdatedAt === value.foodRulesUpdatedAt &&
      new Set(coverage.recipeVersions.map((version) => version.recipeId)).size ===
        coverage.recipeVersions.length &&
      recipeIds.size === coverage.recipeVersions.length &&
      coverage.recipeVersions.every((version) => recipeIds.has(version.recipeId)) &&
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
  const coverage = value.foodRuleCoverage;
  return (
    value.kind === 'ingredient_swap_proposal.v1' &&
    (typeof value.foodRulesUpdatedAt === 'string' || value.foodRulesUpdatedAt === null) &&
    isProposalFoodRuleCoverage(coverage) &&
    coverage.rulesUpdatedAt === value.foodRulesUpdatedAt &&
    coverage.recipeVersions.length === 1 &&
    coverage.recipeVersions[0]?.recipeId === value.recipeId &&
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
  'propose_shopping_list_item',
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
  const modelSelection = getDevAiModelSelection();
  const { data, error } = await getSupabase().functions.invoke('ai-gateway', {
    body: {
      skill: 'fam-assistant',
      householdId: input.householdId,
      ...(modelSelection ?? {}),
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
    if (code === 'provider_invalid_response' || code === 'provider_empty_response') {
      throw new Error(
        'Der AI-Anbieter hat keine verwertbare Antwort geliefert. Bitte versuche es erneut.',
      );
    }
    if (code === 'provider_unavailable') {
      throw new Error(
        'Der AI-Anbieter ist gerade nicht erreichbar. Bitte versuche es später erneut.',
      );
    }
    if (code === 'provider_rate_limited') {
      throw new Error('Der AI-Anbieter ist gerade ausgelastet. Bitte versuche es später erneut.');
    }
    if (code === 'provider_request_failed') {
      throw new Error(
        'Der AI-Anbieter konnte die Anfrage nicht verarbeiten. Bitte versuche es später erneut.',
      );
    }
    throw new Error(
      'Der Assistant ist gerade nicht erreichbar. Bitte prüfe deine Verbindung und versuche es erneut.',
    );
  }
  return parseAssistantReply(data);
}

export type AiModelTestResult = {
  provider: AiProvider;
  model: string;
  text: string;
  durationMs: number;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

export async function testAiModel(input: {
  householdId: string;
  provider: AiProvider;
  model: string;
  prompt: string;
}): Promise<AiModelTestResult> {
  const { data, error } = await getSupabase().functions.invoke('ai-gateway', {
    body: {
      skill: 'fam-ai-model-test',
      householdId: input.householdId,
      provider: input.provider,
      model: input.model,
      prompt: input.prompt,
    },
  });
  if (error) {
    const code = await getGatewayErrorCode(error, data);
    if (code === 'provider_not_configured') {
      throw new Error(
        `Der ${input.provider === 'groq' ? 'Groq' : 'OpenRouter'}-API-Key fehlt in der lokalen Functions-Umgebung.`,
      );
    }
    if (code === 'model_testing_unavailable') {
      throw new Error('Modelltests sind nur mit der lokalen Supabase-Instanz verfügbar.');
    }
    if (code === 'model_not_allowed') {
      throw new Error(
        `Die Modell-ID ist nicht in der lokalen Allowlist für ${input.provider === 'groq' ? 'Groq' : 'OpenRouter'} freigegeben.`,
      );
    }
    throw new Error(code ?? error.message);
  }
  if (
    !isRecord(data) ||
    data.skill !== 'fam-ai-model-test' ||
    data.provider !== input.provider ||
    data.model !== input.model ||
    typeof data.text !== 'string' ||
    typeof data.durationMs !== 'number'
  ) {
    throw new Error('Die Modelltest-Antwort hatte ein ungültiges Format.');
  }
  const usage = isRecord(data.usage) ? data.usage : undefined;
  return {
    provider: input.provider,
    model: input.model,
    text: data.text,
    durationMs: data.durationMs,
    ...(usage
      ? {
          usage: {
            ...(typeof usage.prompt_tokens === 'number'
              ? { prompt_tokens: usage.prompt_tokens }
              : {}),
            ...(typeof usage.completion_tokens === 'number'
              ? { completion_tokens: usage.completion_tokens }
              : {}),
            ...(typeof usage.total_tokens === 'number' ? { total_tokens: usage.total_tokens } : {}),
          },
        }
      : {}),
  };
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

export async function validateAssistantMealPlanProposal(input: {
  householdId: string;
  proposal: Extract<AssistantProposal, { kind: 'meal_plan_proposal.v1' }>;
}): Promise<{ valid: true } | { valid: false; reason: string }> {
  const coverage = input.proposal.foodRuleCoverage;
  if (coverage?.status !== 'clear') {
    return { valid: false, reason: 'invalid_proposal_snapshot' };
  }

  const recipeIds = [...new Set(input.proposal.meals.map((meal) => meal.recipeId))];
  const { data, error } = await getSupabase().functions.invoke('ai-gateway', {
    body: {
      skill: 'fam-assistant-proposal-validation',
      householdId: input.householdId,
      foodRulesUpdatedAt: input.proposal.foodRulesUpdatedAt,
      coverageRulesUpdatedAt: coverage.rulesUpdatedAt,
      recipeIds,
      recipeVersions: coverage.recipeVersions,
    },
  });
  if (error) {
    const code = await getGatewayErrorCode(error, data);
    throw new Error(code ?? error.message);
  }
  if (
    !isRecord(data) ||
    data.skill !== 'fam-assistant-proposal-validation' ||
    typeof data.valid !== 'boolean' ||
    (!data.valid && typeof data.reason !== 'string')
  ) {
    throw new Error('Der Vorschlag konnte nicht auf Aktualität geprüft werden.');
  }
  return data.valid ? { valid: true } : { valid: false, reason: data.reason as string };
}
