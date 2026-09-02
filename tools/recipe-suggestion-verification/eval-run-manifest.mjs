import { createHash } from 'node:crypto';

export const EVAL_MANIFEST_VERSION = 1;

function nonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value;
}

function uniqueScenarioIds(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError('scenarioIds must contain at least one scenario');
  }

  const ids = value.map((scenarioId, index) => nonEmptyString(scenarioId, `scenarioIds[${index}]`));
  if (new Set(ids).size !== ids.length) throw new TypeError('scenarioIds must be unique');
  return ids;
}

function sha256(value, field) {
  nonEmptyString(value, field);
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function validateResponseFormat(responseFormat) {
  if (
    responseFormat === null ||
    typeof responseFormat !== 'object' ||
    Array.isArray(responseFormat) ||
    responseFormat.type !== 'json_schema' ||
    responseFormat.json_schema === null ||
    typeof responseFormat.json_schema !== 'object' ||
    Array.isArray(responseFormat.json_schema)
  ) {
    throw new TypeError('responseFormat must be a json_schema response format');
  }

  const jsonSchema = responseFormat.json_schema;
  nonEmptyString(jsonSchema.name, 'responseFormat.json_schema.name');
  if (jsonSchema.strict !== true) {
    throw new TypeError('responseFormat.json_schema.strict must be true');
  }
  if (
    jsonSchema.schema === null ||
    typeof jsonSchema.schema !== 'object' ||
    Array.isArray(jsonSchema.schema)
  ) {
    throw new TypeError('responseFormat.json_schema.schema must be an object');
  }

  return {
    type: 'json_schema',
    json_schema: {
      name: jsonSchema.name,
      strict: true,
      schema: structuredClone(jsonSchema.schema),
    },
  };
}

function normalizeAttempts(attempts, scenarioIds) {
  if (!Array.isArray(attempts) || attempts.length === 0) {
    throw new TypeError('attempts must contain at least one attempt');
  }

  const scenarioOrder = new Map(scenarioIds.map((scenarioId, index) => [scenarioId, index]));
  const normalized = attempts.map((attempt, index) => {
    if (attempt === null || typeof attempt !== 'object' || Array.isArray(attempt)) {
      throw new TypeError(`attempts[${index}] must be an object`);
    }
    const scenarioId = nonEmptyString(attempt.scenarioId, `attempts[${index}].scenarioId`);
    if (!scenarioOrder.has(scenarioId)) {
      throw new TypeError(`attempts[${index}].scenarioId is not selected`);
    }
    if (!Number.isInteger(attempt.retryIndex) || attempt.retryIndex < 0) {
      throw new TypeError(`attempts[${index}].retryIndex must be a non-negative integer`);
    }
    const finishReason = nonEmptyString(
      attempt.finishReason,
      `attempts[${index}].finishReason`,
    );
    if (typeof attempt.pass !== 'boolean') {
      throw new TypeError(`attempts[${index}].pass must be boolean`);
    }
    return {
      scenario_id: scenarioId,
      retry_index: attempt.retryIndex,
      finish_reason: finishReason,
      pass: attempt.pass,
    };
  });

  const seen = new Set();
  for (const attempt of normalized) {
    const key = `${attempt.scenario_id}\u0000${attempt.retry_index}`;
    if (seen.has(key)) throw new TypeError(`duplicate attempt: ${key}`);
    seen.add(key);
  }

  const sorted = [...normalized].sort(
    (left, right) =>
      scenarioOrder.get(left.scenario_id) - scenarioOrder.get(right.scenario_id) ||
      left.retry_index - right.retry_index,
  );
  for (const scenarioId of scenarioIds) {
    const scenarioAttempts = sorted.filter((attempt) => attempt.scenario_id === scenarioId);
    if (scenarioAttempts.length === 0) {
      throw new TypeError(`scenario has no attempt: ${scenarioId}`);
    }
    scenarioAttempts.forEach((attempt, index) => {
      if (attempt.retry_index !== index) {
        throw new TypeError(`retry indexes must be contiguous for scenario: ${scenarioId}`);
      }
    });
  }
  return sorted;
}

function summarizeAttempts(attempts, scenarioIds) {
  const finishReasons = new Map();
  const attemptsByScenario = new Map(scenarioIds.map((scenarioId) => [scenarioId, []]));
  for (const attempt of attempts) {
    finishReasons.set(
      attempt.finish_reason,
      (finishReasons.get(attempt.finish_reason) ?? 0) + 1,
    );
    attemptsByScenario.get(attempt.scenario_id).push(attempt);
  }

  const sortedFinishReasons = Object.fromEntries(
    [...finishReasons.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
  const finalPass = (scenarioId) => {
    const scenarioAttempts = attemptsByScenario.get(scenarioId);
    return scenarioAttempts[scenarioAttempts.length - 1].pass;
  };

  return {
    scenario_count: scenarioIds.length,
    attempt_count: attempts.length,
    retry_count: attempts.length - scenarioIds.length,
    finish_reasons: sortedFinishReasons,
    passed_scenarios: scenarioIds.filter(finalPass),
    failed_scenarios: scenarioIds.filter((scenarioId) => !finalPass(scenarioId)),
  };
}

export function createEvalRunManifest({
  provider,
  model,
  effectiveConfig,
  responseFormat,
  configText,
  promptText,
  schemaText,
  scenarioIds,
  attempts,
}) {
  const selectedScenarioIds = uniqueScenarioIds(scenarioIds);
  const normalizedAttempts = normalizeAttempts(attempts, selectedScenarioIds);
  const normalizedResponseFormat = validateResponseFormat(responseFormat);
  nonEmptyString(provider, 'provider');
  nonEmptyString(model, 'model');
  if (effectiveConfig === null || typeof effectiveConfig !== 'object' || Array.isArray(effectiveConfig)) {
    throw new TypeError('effectiveConfig must be an object');
  }

  return {
    manifest_version: EVAL_MANIFEST_VERSION,
    provider,
    model,
    effective_config: structuredClone(effectiveConfig),
    structured_output: normalizedResponseFormat,
    selected_scenario_ids: selectedScenarioIds,
    artifact_hashes: {
      config_sha256: sha256(configText, 'configText'),
      prompt_sha256: sha256(promptText, 'promptText'),
      schema_sha256: sha256(schemaText, 'schemaText'),
    },
    attempts: normalizedAttempts,
    summary: summarizeAttempts(normalizedAttempts, selectedScenarioIds),
  };
}
