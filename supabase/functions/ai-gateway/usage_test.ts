import { assertEquals } from 'jsr:@std/assert@1';

import { toAiUsageEvent } from './usage.ts';

Deno.test('maps provider usage to one content-free, caller-attributed event', () => {
  assertEquals(
    toAiUsageEvent({
      userId: 'user-1',
      subscriberUserId: 'subscriber-1',
      householdId: 'household-1',
      requestId: 'request-1',
      providerCallIndex: 2,
      provider: 'openrouter',
      model: 'z-ai/glm-5.3-flash',
      skill: 'fam-assistant',
      isTest: false,
      usage: {
        prompt_tokens: 400,
        completion_tokens: 100,
        total_tokens: 500,
        cost: 0.000123,
        prompt: 'must not be stored',
        completion: 'must not be stored',
      },
    }),
    {
      request_id: 'request-1',
      provider_call_index: 2,
      user_id: 'user-1',
      subscriber_user_id: 'subscriber-1',
      household_id: 'household-1',
      provider: 'openrouter',
      model: 'z-ai/glm-5.3-flash',
      skill: 'fam-assistant',
      is_test: false,
      prompt_tokens: 400,
      completion_tokens: 100,
      total_tokens: 500,
      provider_cost_usd: 0.000123,
      cost_source: 'provider_reported',
    },
  );
});

Deno.test('keeps unreported cost and invalid token values empty', () => {
  const event = toAiUsageEvent({
    userId: 'user-1',
    subscriberUserId: null,
    householdId: 'household-1',
    requestId: 'request-2',
    providerCallIndex: 0,
    provider: 'groq',
    model: 'openai/gpt-oss-20b',
    skill: 'fam-ai-model-test',
    isTest: true,
    usage: { prompt_tokens: 10.5, completion_tokens: -1, total_tokens: '10', cost: null },
  });

  assertEquals(event.prompt_tokens, 10);
  assertEquals(event.completion_tokens, null);
  assertEquals(event.total_tokens, null);
  assertEquals(event.provider_cost_usd, null);
  assertEquals(event.cost_source, null);
});
