import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EVAL_MANIFEST_VERSION,
  createEvalRunManifest,
} from './eval-run-manifest.mjs';

const baseInput = {
  provider: 'openrouter:ibm-granite/granite-4.2-8b',
  model: 'ibm-granite/granite-4.2-8b',
  effectiveConfig: {
    temperature: 0,
    top_p: 1,
    seed: 0,
    reasoning: { effort: 'low' },
  },
  responseFormat: {
    type: 'json_schema',
    json_schema: {
      name: 'recipe_suggestion_response',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['schema_version', 'meals'],
        properties: {},
      },
    },
  },
  configText: 'temperature: 0\nseed: 0\n',
  promptText: 'recipe suggestion prompt',
  schemaText: '{"schema_version":1}',
  scenarioIds: ['empty-shopping-list', 'generative-fallback'],
  attempts: [
    {
      scenarioId: 'empty-shopping-list',
      retryIndex: 0,
      finishReason: 'stop',
      pass: true,
    },
    {
      scenarioId: 'generative-fallback',
      retryIndex: 0,
      finishReason: 'length',
      pass: false,
    },
    {
      scenarioId: 'generative-fallback',
      retryIndex: 1,
      finishReason: 'stop',
      pass: true,
    },
  ],
};

test('creates a reproducible versioned manifest with hashes and effective config', () => {
  const manifest = createEvalRunManifest(baseInput);

  assert.equal(manifest.manifest_version, EVAL_MANIFEST_VERSION);
  assert.deepEqual(manifest.structured_output, baseInput.responseFormat);
  assert.deepEqual(manifest.effective_config, baseInput.effectiveConfig);
  assert.deepEqual(manifest.selected_scenario_ids, baseInput.scenarioIds);
  assert.match(manifest.artifact_hashes.config_sha256, /^[a-f0-9]{64}$/);
  assert.match(manifest.artifact_hashes.prompt_sha256, /^[a-f0-9]{64}$/);
  assert.match(manifest.artifact_hashes.schema_sha256, /^[a-f0-9]{64}$/);
});

test('counts attempts, retries, finish reasons and final scenario outcomes deterministically', () => {
  const manifest = createEvalRunManifest(baseInput);

  assert.deepEqual(manifest.summary, {
    scenario_count: 2,
    attempt_count: 3,
    retry_count: 1,
    finish_reasons: { length: 1, stop: 2 },
    passed_scenarios: ['empty-shopping-list', 'generative-fallback'],
    failed_scenarios: [],
  });
  assert.deepEqual(
    manifest.attempts.map((attempt) => [attempt.scenario_id, attempt.retry_index]),
    [
      ['empty-shopping-list', 0],
      ['generative-fallback', 0],
      ['generative-fallback', 1],
    ],
  );
});

test('changing any tracked artifact changes only its corresponding hash', () => {
  const baseline = createEvalRunManifest(baseInput);
  const changedPrompt = createEvalRunManifest({
    ...baseInput,
    promptText: `${baseInput.promptText}!`,
  });
  const changedSchema = createEvalRunManifest({
    ...baseInput,
    schemaText: '{"schema_version":2}',
  });

  assert.notEqual(changedPrompt.artifact_hashes.prompt_sha256, baseline.artifact_hashes.prompt_sha256);
  assert.equal(changedPrompt.artifact_hashes.config_sha256, baseline.artifact_hashes.config_sha256);
  assert.equal(changedPrompt.artifact_hashes.schema_sha256, baseline.artifact_hashes.schema_sha256);
  assert.notEqual(changedSchema.artifact_hashes.schema_sha256, baseline.artifact_hashes.schema_sha256);
  assert.equal(changedSchema.artifact_hashes.config_sha256, baseline.artifact_hashes.config_sha256);
});

test('rejects non-strict output, duplicate scenarios, missing attempts and retry gaps', () => {
  assert.throws(
    () => createEvalRunManifest({ ...baseInput, responseFormat: { ...baseInput.responseFormat, json_schema: { ...baseInput.responseFormat.json_schema, strict: false } } }),
    /strict must be true/,
  );
  assert.throws(
    () => createEvalRunManifest({ ...baseInput, responseFormat: { ...baseInput.responseFormat, json_schema: { ...baseInput.responseFormat.json_schema, schema: 'file://schema.json' } } }),
    /schema must be an object/,
  );
  assert.throws(
    () => createEvalRunManifest({ ...baseInput, scenarioIds: ['same', 'same'] }),
    /scenarioIds must be unique/,
  );
  assert.throws(
    () => createEvalRunManifest({ ...baseInput, attempts: [baseInput.attempts[0]] }),
    /scenario has no attempt/,
  );
  assert.throws(
    () => createEvalRunManifest({
      ...baseInput,
      attempts: baseInput.attempts.map((attempt) =>
        attempt.scenarioId === 'generative-fallback'
          ? { ...attempt, retryIndex: attempt.retryIndex + 1 }
          : attempt,
      ),
    }),
    /retry indexes must be contiguous/,
  );
});
