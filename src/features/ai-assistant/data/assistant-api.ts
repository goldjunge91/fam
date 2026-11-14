import { getSupabase } from '@/lib/backend/supabase/remote-client';
import type { AiProvider } from '../model-catalog';
import type {
  AiCreditStatus,
  AssistantAttachment,
  AssistantHistoryMessage,
  AssistantPageContext,
  AssistantProposal,
  AssistantProposalFoodRuleCoverage,
  AssistantRecipeReference,
  AssistantReply,
  AssistantToolName,
} from '../types';
import { getDevAiModelSelection } from './dev-ai-model-selection';

type SendAssistantMessageInput = {
  householdId: string;
  message: string;
  history: readonly AssistantHistoryMessage[];
  includeHouseholdContext: boolean;
  focusedInventoryLotIds?: readonly string[];
  pageContext?: AssistantPageContext;
  attachments?: readonly AssistantAttachment[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function gatewayError(message: string, retryable = false): Error {
  return Object.assign(new Error(message), { retryable });
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

function isAssistantRecipeReference(value: unknown): value is AssistantRecipeReference {
  return (
    isRecord(value) &&
    typeof value.recipeId === 'string' &&
    value.recipeId.length > 0 &&
    value.recipeId.length <= 128 &&
    typeof value.title === 'string' &&
    value.title.length > 0 &&
    value.title.length <= 200 &&
    (value.source === 'household' || value.source === 'catalog') &&
    (value.source !== 'catalog' || (typeof value.slug === 'string' && value.slug.length > 0)) &&
    (value.slug === undefined || (typeof value.slug === 'string' && value.slug.length <= 160)) &&
    (value.coverImagePath === undefined ||
      value.coverImagePath === null ||
      (typeof value.coverImagePath === 'string' && value.coverImagePath.length <= 500))
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
          validIsoDate(meal.date) &&
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

const ASSISTANT_TOOL_NAMES: AssistantToolName[] = [
  'search_recipes',
  'get_inventory',
  'get_shopping_list',
  'propose_meal_plan',
  'suggest_ingredient_swap',
  'propose_shopping_list_item',
  'propose_shopping_list_items',
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
    (value.result.recipeReferences !== undefined &&
      (!Array.isArray(value.result.recipeReferences) ||
        value.result.recipeReferences.length > 8 ||
        !value.result.recipeReferences.every(isAssistantRecipeReference))) ||
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
  const totalTokens =
    typeof usage?.total_tokens === 'number' && Number.isFinite(usage.total_tokens)
      ? usage.total_tokens
      : undefined;
  const cost =
    typeof usage?.cost === 'number' && Number.isFinite(usage.cost) ? usage.cost : undefined;
  return {
    requestId: value.requestId,
    skill: 'fam-assistant',
    model: value.model,
    result: {
      kind: 'assistant_reply.v1',
      text: value.result.text,
      suggestions: value.result.suggestions,
      recipeReferences: Array.isArray(value.result.recipeReferences)
        ? value.result.recipeReferences
        : [],
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
      message: input.message,
      history: input.history.slice(-12),
      includeHouseholdContext: input.includeHouseholdContext,
      ...(input.focusedInventoryLotIds !== undefined
        ? { focusedInventoryLotIds: input.focusedInventoryLotIds }
        : {}),
      ...(input.pageContext ? { pageContext: input.pageContext } : {}),
      ...(input.attachments && input.attachments.length > 0
        ? { attachments: input.attachments }
        : {}),
    },
  });

  if (error) {
    const code = await getGatewayErrorCode(error, data);
    if (code === 'ai_subscription_required') {
      throw gatewayError('Für den Assistant brauchst du das AI-Abo dieses Haushalts.');
    }
    if (code === 'ai_credit_limit_exceeded') {
      throw gatewayError('Das monatliche AI-Credit-Limit ist erreicht.');
    }
    if (code === 'model_not_allowed') {
      throw gatewayError('Dieses AI-Modell ist derzeit nicht verfügbar.');
    }
    if (code === 'invalid_assistant_reply') {
      throw gatewayError(
        'Die KI hat gerade eine ungültige Antwort geliefert. Bitte versuche es erneut.',
        true,
      );
    }
    if (code === 'provider_not_configured') {
      throw gatewayError(
        'Der ausgewählte KI-Anbieter ist serverseitig nicht konfiguriert. Bitte wähle ein anderes Modell.',
        false,
      );
    }
    if (code === 'provider_invalid_json') {
      throw gatewayError('Die KI konnte gerade keine passende Antwort erstellen.', true);
    }
    if (code === 'provider_invalid_response' || code === 'provider_empty_response') {
      throw gatewayError('Die KI konnte gerade keine passende Antwort erstellen.', true);
    }
    if (code === 'provider_unavailable') {
      throw gatewayError(
        'Die KI ist gerade nicht erreichbar. Bitte versuche es später erneut.',
        true,
      );
    }
    if (code === 'provider_rate_limited') {
      throw gatewayError(
        'Die KI ist gerade stark ausgelastet. Bitte versuche es später erneut.',
        true,
      );
    }
    if (code === 'provider_request_failed') {
      throw gatewayError(
        'Die Anfrage konnte gerade nicht verarbeitet werden. Bitte versuche es später erneut.',
      );
    }
    throw gatewayError(
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
      throw gatewayError(
        `Der ${input.provider === 'groq' ? 'Groq' : 'OpenRouter'}-API-Key fehlt in der lokalen Functions-Umgebung.`,
        false,
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

export async function validateAssistantRecipeProposal(input: {
  householdId: string;
  proposal: Extract<AssistantProposal, { kind: 'ingredient_swap_proposal.v1' }>;
}): Promise<{ valid: true } | { valid: false; reason: string }> {
  const coverage = input.proposal.foodRuleCoverage;
  if (
    coverage?.status !== 'clear' ||
    coverage.recipeVersions.length !== 1 ||
    coverage.recipeVersions[0]?.recipeId !== input.proposal.recipeId
  ) {
    return { valid: false, reason: 'invalid_proposal_snapshot' };
  }

  const { data, error } = await getSupabase().functions.invoke('ai-gateway', {
    body: {
      skill: 'fam-assistant-proposal-validation',
      householdId: input.householdId,
      foodRulesUpdatedAt: input.proposal.foodRulesUpdatedAt,
      coverageRulesUpdatedAt: coverage.rulesUpdatedAt,
      recipeIds: [input.proposal.recipeId],
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
