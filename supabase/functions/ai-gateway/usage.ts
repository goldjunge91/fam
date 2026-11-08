export type AiUsageRecordInput = {
  userId: string;
  subscriberUserId: string | null;
  householdId: string;
  requestId: string;
  providerCallIndex: number;
  provider: 'openrouter' | 'groq';
  model: string;
  skill: string;
  isTest: boolean;
  usage: unknown;
};

export type AiUsageEventInsert = {
  request_id: string;
  provider_call_index: number;
  user_id: string;
  subscriber_user_id: string | null;
  household_id: string;
  provider: 'openrouter' | 'groq';
  model: string;
  skill: string;
  is_test: boolean;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  provider_cost_usd: number | null;
  cost_source: 'provider_reported' | null;
};

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : null;
}

function nonNegativeMoney(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toAiUsageEvent(input: AiUsageRecordInput): AiUsageEventInsert {
  const usage = isRecord(input.usage) ? input.usage : {};
  const providerCost = nonNegativeMoney(usage.cost);

  return {
    request_id: input.requestId,
    provider_call_index: input.providerCallIndex,
    user_id: input.userId,
    subscriber_user_id: input.subscriberUserId,
    household_id: input.householdId,
    provider: input.provider,
    model: input.model,
    skill: input.skill,
    is_test: input.isTest,
    prompt_tokens: nonNegativeInteger(usage.prompt_tokens),
    completion_tokens: nonNegativeInteger(usage.completion_tokens),
    total_tokens: nonNegativeInteger(usage.total_tokens),
    provider_cost_usd: providerCost,
    cost_source: providerCost === null ? null : 'provider_reported',
  };
}
