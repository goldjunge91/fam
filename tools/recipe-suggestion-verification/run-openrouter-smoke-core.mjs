import assertRecipeSuggestion from './promptfoo/assertions/recipe-suggestion.js';

function providerError(responseText) {
  try {
    const body = JSON.parse(responseText);
    const error = body?.error;
    if (typeof error === 'string') return error;
    if (error && typeof error.message === 'string') return error.message;
  } catch {
    // The bounded response excerpt below is enough when the provider did not return JSON.
  }
  return responseText.trim().slice(0, 1000) || 'Unbekannter Provider-Fehler';
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function runAttempt({ fetchImpl, endpoint, apiKey, requestBody, compactContext }) {
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    return {
      httpStatus: null,
      finishReason: 'request_error',
      usage: null,
      semanticPass: false,
      semanticReason: errorMessage(error),
      retryable: false,
    };
  }

  const responseText = await response.text();
  if (!response.ok) {
    return {
      httpStatus: response.status,
      finishReason: 'provider_error',
      usage: null,
      semanticPass: false,
      semanticReason: `OpenRouter HTTP ${response.status}: ${providerError(responseText)}`,
      retryable: false,
    };
  }

  let body;
  try {
    body = JSON.parse(responseText);
  } catch (error) {
    return {
      httpStatus: response.status,
      finishReason: 'invalid_provider_json',
      usage: null,
      semanticPass: false,
      semanticReason: `OpenRouter antwortete mit ungültigem JSON: ${errorMessage(error)}`,
      retryable: false,
    };
  }

  const choice = body?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    const refusal = choice?.message?.refusal;
    return {
      httpStatus: response.status,
      finishReason: 'empty_provider_response',
      usage: body.usage ?? null,
      semanticPass: false,
      semanticReason: `OpenRouter lieferte keinen Rezeptvorschlag${refusal ? `: ${refusal}` : '.'}`,
      retryable: false,
    };
  }

  const semanticResult = assertRecipeSuggestion(content, {
    vars: { compact_context: JSON.stringify(compactContext) },
  });
  return {
    httpStatus: response.status,
    finishReason: typeof choice.finish_reason === 'string' ? choice.finish_reason : 'unknown',
    usage: body.usage ?? null,
    semanticPass: semanticResult.pass === true,
    semanticReason: semanticResult.reason ?? null,
    retryable: semanticResult.pass !== true,
  };
}

export async function runOpenRouterScenario({
  fetchImpl = globalThis.fetch,
  endpoint,
  apiKey,
  model,
  prompt,
  responseFormat,
  compactContext,
  reasoningEffort = 'low',
  semanticRetryLimit = 0,
}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl muss eine Funktion sein.');
  if (!Number.isInteger(semanticRetryLimit) || semanticRetryLimit < 0) {
    throw new TypeError('semanticRetryLimit muss eine nicht-negative ganze Zahl sein.');
  }

  const requestBody = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    top_p: 1,
    seed: 0,
    max_tokens: 1536,
    reasoning: { effort: reasoningEffort },
    provider: { require_parameters: true },
    response_format: responseFormat,
  };
  const attempts = [];

  for (let retryIndex = 0; retryIndex <= semanticRetryLimit; retryIndex += 1) {
    const result = await runAttempt({
      fetchImpl,
      endpoint,
      apiKey,
      requestBody,
      compactContext,
    });
    attempts.push({ retryIndex, ...result });
    if (result.semanticPass || !result.retryable) break;
  }

  return { attempts, finalAttempt: attempts.at(-1) };
}
