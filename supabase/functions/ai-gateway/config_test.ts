import { assertEquals } from 'jsr:@std/assert@1';

import {
  AI_GATEWAY_FLOW_PROFILES,
  AI_GATEWAY_FLOWS,
  DEFAULT_MEDIA_FALLBACK,
  GROQ_TRANSCRIPTION_PROFILE,
  resolveAiGatewayFlowConfig,
  SHARED_COMPLETION_MAX_TOKENS,
} from './config.ts';

const FLOW_NAMES = Object.values(AI_GATEWAY_FLOWS);

Deno.test('defines one named profile for every gateway completion flow', () => {
  assertEquals(Object.keys(AI_GATEWAY_FLOW_PROFILES), FLOW_NAMES);
  for (const profile of Object.values(AI_GATEWAY_FLOW_PROFILES)) {
    assertEquals(Object.hasOwn(profile, 'provider'), false);
    assertEquals(Object.hasOwn(profile, 'model'), false);
  }
});

Deno.test('inherits the project provider and model for every named flow', () => {
  const projectDefaults = { provider: 'groq' as const, model: 'openai/gpt-oss-120b' };

  for (const flow of FLOW_NAMES) {
    const resolved = resolveAiGatewayFlowConfig(flow, projectDefaults);
    assertEquals(resolved.provider, projectDefaults.provider);
    assertEquals(resolved.model, projectDefaults.model);
    assertEquals(resolved.flow, flow);
  }
});

Deno.test('uses the shared completion budget unless a flow opts into another budget', () => {
  const projectDefaults = { provider: 'openrouter' as const, model: 'z-ai/glm-5.3-flash' };

  for (const flow of [AI_GATEWAY_FLOWS.assistant, AI_GATEWAY_FLOWS.inventoryCapture]) {
    assertEquals(
      resolveAiGatewayFlowConfig(flow, projectDefaults).maxTokens,
      SHARED_COMPLETION_MAX_TOKENS,
    );
  }
  assertEquals(
    resolveAiGatewayFlowConfig(AI_GATEWAY_FLOWS.cookingFromInventory, projectDefaults).maxTokens,
    4_096,
  );
  assertEquals(
    resolveAiGatewayFlowConfig(AI_GATEWAY_FLOWS.localModelTest, projectDefaults).maxTokens,
    1_024,
  );
});

Deno.test('applies only the configured reasoning overrides to recipe and cooking flows', () => {
  const projectDefaults = { provider: 'groq' as const, model: 'qwen/qwen3.8-27b' };
  const expected = { reasoning_format: 'hidden' as const, reasoning_effort: 'none' as const };

  assertEquals(
    resolveAiGatewayFlowConfig(AI_GATEWAY_FLOWS.recipeImport, projectDefaults).reasoning.groq,
    expected,
  );
  assertEquals(
    resolveAiGatewayFlowConfig(AI_GATEWAY_FLOWS.cookingFromInventory, projectDefaults).reasoning
      .groq,
    expected,
  );
  assertEquals(
    resolveAiGatewayFlowConfig(AI_GATEWAY_FLOWS.assistant, projectDefaults).reasoning.groq,
    undefined,
  );
  assertEquals(
    resolveAiGatewayFlowConfig(AI_GATEWAY_FLOWS.localModelTest, projectDefaults).reasoning.groq,
    undefined,
  );
});

Deno.test('keeps the Granite compatibility flag model-specific', () => {
  const granite = resolveAiGatewayFlowConfig(AI_GATEWAY_FLOWS.assistant, {
    provider: 'openrouter',
    model: 'ibm-granite/granite-4.2-8b',
  });
  const otherModel = resolveAiGatewayFlowConfig(AI_GATEWAY_FLOWS.assistant, {
    provider: 'openrouter',
    model: 'z-ai/glm-5.3-flash',
  });

  assertEquals(granite.reasoning.openrouter, { enabled: false });
  assertEquals(otherModel.reasoning.openrouter, undefined);
});

Deno.test('keeps media fallback and Instagram transcription compatibility values fixed', () => {
  assertEquals(DEFAULT_MEDIA_FALLBACK, {
    provider: 'openrouter',
    model: 'qwen/qwen3.8-flash',
  });
  assertEquals(GROQ_TRANSCRIPTION_PROFILE, {
    provider: 'groq',
    model: 'whisper-large-v3-turbo',
  });
});
