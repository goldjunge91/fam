import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createEvalRunManifest } from './eval-run-manifest.mjs';
import { parseSmokeArgs } from './run-openrouter-smoke-args.mjs';
import { runOpenRouterScenario } from './run-openrouter-smoke-core.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));

async function readArtifact(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

async function readDataset() {
  const content = await readArtifact('chainforge/recipe-suggestion-dataset.jsonl');
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Dataset-Zeile ${index + 1} ist kein gültiges JSON: ${error.message}`);
      }
    });
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} ist nicht gesetzt.`);
  return value;
}

const rows = await readDataset();
const { scenarioId, retries } = parseSmokeArgs(
  process.argv.slice(2),
  rows.map((row) => row.scenario_id),
);
const scenario = rows.find((row) => row.scenario_id === scenarioId);

const apiKey = requiredEnvironment('OPENROUTER_API_KEY');
const baseUrl = (process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1').replace(
  /\/$/,
  '',
);
const model = process.env.OPENROUTER_MODEL?.trim() || 'ibm-granite/granite-4.2-8b';
const promptTemplate = await readArtifact('promptfoo/prompts/recipe-suggestion.prompt.txt');
const prompt = promptTemplate.replace(
  '{{compact_context}}',
  JSON.stringify(scenario.compact_context),
);
const responseFormat = JSON.parse(
  await readArtifact('promptfoo/schemas/recipe-suggestion-response-format.json'),
);
const schemaText = await readArtifact('promptfoo/schemas/recipe-suggestion-response.schema.json');

const { attempts: attemptResults } = await runOpenRouterScenario({
  endpoint: `${baseUrl}/chat/completions`,
  apiKey,
  model,
  prompt,
  responseFormat,
  compactContext: scenario.compact_context,
  reasoningEffort: process.env.OPENROUTER_REASONING_EFFORT?.trim() || 'low',
  semanticRetryLimit: retries,
});

const finalAttempt = attemptResults.at(-1);
const manifest = createEvalRunManifest({
  provider: `openrouter:${model}`,
  model,
  effectiveConfig: {
    apiKeyEnvar: 'OPENROUTER_API_KEY',
    temperature: 0,
    top_p: 1,
    seed: 0,
    max_tokens: 1536,
    reasoning: {
      effort: process.env.OPENROUTER_REASONING_EFFORT?.trim() || 'low',
    },
    provider: { require_parameters: true },
    semantic_retry_limit: retries,
  },
  responseFormat,
  configText: await readArtifact('promptfoo/promptfooconfig.yaml'),
  promptText: promptTemplate,
  schemaText,
  scenarioIds: [scenario.scenario_id],
  attempts: attemptResults.map((attempt) => ({
    scenarioId: scenario.scenario_id,
      retryIndex: attempt.retryIndex,
    finishReason: attempt.finishReason,
    pass: attempt.semanticPass,
  })),
});

console.log(
  JSON.stringify(
    {
      http_status: finalAttempt.httpStatus,
      model,
      scenario_id: scenario.scenario_id,
      finish_reason: finalAttempt.finishReason,
      usage: finalAttempt.usage,
      semantic_pass: finalAttempt.semanticPass,
      semantic_reason: finalAttempt.semanticReason,
      attempt_count: attemptResults.length,
      attempts: attemptResults.map(({ retryIndex, httpStatus, finishReason, usage, semanticPass, semanticReason }) => ({
        retry_index: retryIndex,
        http_status: httpStatus,
        finish_reason: finishReason,
        usage,
        semantic_pass: semanticPass,
        semantic_reason: semanticReason,
      })),
      manifest,
    },
    null,
    2,
  ),
);

if (finalAttempt.semanticPass !== true) process.exitCode = 1;
