import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runOpenRouterScenario } from './run-openrouter-smoke-core.mjs';

const compactContext = {
  schema_version: 1,
  request: { type: 'recipe_suggestion', servings: 2 },
  constraints: {
    allergies: [],
    preferences: [],
    allowed_staples: ['water'],
    forbidden_ingredients: ['peanut'],
  },
  priority_foods: [
    {
      inventory_item_id: 'inv_oats',
      name: 'Haferflocken',
      available_quantity: 200,
      unit: 'g',
      priority_score: 1,
    },
  ],
  planned_shopping_items: [],
  candidate_recipes: [
    {
      id: 'recipe-oats',
      source: 'template',
      title: 'Haferbrei',
      ingredient_names: ['Haferflocken', 'water'],
    },
  ],
  shopping_question: null,
  fallback_allowed: false,
};

const responseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'recipe_suggestion_response',
    strict: true,
    schema: { type: 'object' },
  },
};

const validOutput = JSON.stringify({
  schema_version: 1,
  meals: [
    {
      title: 'Haferbrei',
      source: 'template',
      recipe_id: 'recipe-oats',
      servings: 2,
      used_items: [{ inventory_item_id: 'inv_oats', quantity: 100, unit: 'g' }],
      additional_ingredients: ['water'],
      steps: ['Kochen.'],
      notes: [],
    },
  ],
});

function jsonResponse(content, { status = 200, ok = status >= 200 && status < 300 } = {}) {
  return {
    ok,
    status,
    text: async () =>
      JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { content } }],
        usage: { total_tokens: 10 },
      }),
  };
}

test('retries only a semantic failure, keeps requests identical and stops on success', async () => {
  const requestBodies = [];
  let callCount = 0;
  const result = await runOpenRouterScenario({
    fetchImpl: async (_endpoint, init) => {
      requestBodies.push(init.body);
      callCount += 1;
      return jsonResponse(callCount === 1 ? validOutput.replace('inv_oats', 'foreign') : validOutput);
    },
    endpoint: 'https://example.test/chat/completions',
    apiKey: 'test-key',
    model: 'test-model',
    prompt: 'test-prompt',
    responseFormat,
    compactContext,
    semanticRetryLimit: 2,
  });

  assert.equal(callCount, 2);
  assert.equal(requestBodies[0], requestBodies[1]);
  assert.equal(JSON.parse(requestBodies[0]).max_tokens, 8192);
  assert.deepEqual(
    result.attempts.map(({ retryIndex, semanticPass }) => [retryIndex, semanticPass]),
    [[0, false], [1, true]],
  );
  assert.equal(result.finalAttempt.semanticPass, true);
});

test('does not retry provider failures', async () => {
  let callCount = 0;
  const result = await runOpenRouterScenario({
    fetchImpl: async () => {
      callCount += 1;
      return jsonResponse(JSON.stringify({ error: { message: 'rate limited' } }), { status: 429, ok: false });
    },
    endpoint: 'https://example.test/chat/completions',
    apiKey: 'test-key',
    model: 'test-model',
    prompt: 'test-prompt',
    responseFormat,
    compactContext,
    semanticRetryLimit: 2,
  });

  assert.equal(callCount, 1);
  assert.equal(result.finalAttempt.finishReason, 'provider_error');
  assert.equal(result.finalAttempt.semanticPass, false);
});

test('stops after the bounded semantic retry limit', async () => {
  let callCount = 0;
  const result = await runOpenRouterScenario({
    fetchImpl: async () => {
      callCount += 1;
      return jsonResponse(validOutput.replace('inv_oats', 'foreign'));
    },
    endpoint: 'https://example.test/chat/completions',
    apiKey: 'test-key',
    model: 'test-model',
    prompt: 'test-prompt',
    responseFormat,
    compactContext,
    semanticRetryLimit: 2,
  });

  assert.equal(callCount, 3);
  assert.deepEqual(result.attempts.map(({ retryIndex }) => retryIndex), [0, 1, 2]);
  assert.equal(result.finalAttempt.semanticPass, false);
});

test('Solar request and effective manifest config omit unsupported seed', async () => {
  let request;
  const result = await runOpenRouterScenario({
    fetchImpl: async (_endpoint, init) => { request = init; return jsonResponse(validOutput); },
    endpoint: 'https://example.test/chat/completions', apiKey: 'test-key',
    model: 'upstage/solar-pro4', prompt: 'test', responseFormat, compactContext,
  });
  assert.equal(JSON.parse(request.body).seed, undefined);
  assert.ok(request.signal instanceof AbortSignal);
  assert.equal(result.effectiveConfig.seed, undefined);
  assert.equal(result.effectiveConfig.max_tokens, 8192);
  assert.deepEqual(result.effectiveConfig.reasoning, { enabled: false });
});

test('incomplete output never passes or triggers semantic retries', async () => {
  for (const reason of ['length', 'content_filter', 'error']) {
    let count = 0;
    const result = await runOpenRouterScenario({
      fetchImpl: async () => { count++; return {
        ok: true, status: 200, text: async () => JSON.stringify({ choices: [
          { finish_reason: reason, message: { content: validOutput } },
        ] }),
      }; },
      endpoint: 'https://example.test/chat/completions', apiKey: 'test-key',
      model: 'test', prompt: 'test', responseFormat, compactContext, semanticRetryLimit: 2,
    });
    assert.equal(result.finalAttempt.semanticPass, false);
    assert.equal(result.finalAttempt.finishReason, reason);
    assert.equal(count, 1);
  }
});
