import {
  type AiGatewayFlow,
  type AiGatewayProjectDefaults,
  DEFAULT_AI_GATEWAY_PROVIDER,
  type GatewayProvider,
  GROQ_TRANSCRIPTION_PROFILE,
  PROVIDER_DEFAULT_MODELS,
  resolveAiGatewayFlowConfig,
} from './config.ts';
import type {
  ProviderMessage,
  ProviderResponseFormat,
  ProviderResult,
  ProviderTool,
} from './handler.ts';

export type ProviderCompletionInput = {
  flow: AiGatewayFlow;
  provider?: GatewayProvider;
  model?: string;
  messages: ProviderMessage[];
  tools?: ProviderTool[];
  responseFormat?: ProviderResponseFormat;
};

export type ProviderConfiguration = {
  projectDefaults?: AiGatewayProjectDefaults;
  defaultProvider?: GatewayProvider;
  defaultModel?: string;
  openRouterKey?: string;
  openRouterBaseUrl?: string;
  openRouterSiteUrl?: string;
  openRouterSiteName?: string;
  groqKey?: string;
  groqBaseUrl?: string;
  timeoutMs?: number;
};

function providerBaseUrl(provider: GatewayProvider, config: ProviderConfiguration): string {
  return (provider === 'groq'
    ? config.groqBaseUrl ?? 'https://api.groq.com/openai/v1'
    : config.openRouterBaseUrl ?? 'https://openrouter.ai/api/v1').replace(/\/$/, '');
}

function providerKey(provider: GatewayProvider, config: ProviderConfiguration): string | undefined {
  const value = provider === 'groq' ? config.groqKey : config.openRouterKey;
  return value?.trim() || undefined;
}

function normalizedResponseFormat(value: ProviderResponseFormat | undefined) {
  return value === 'json_object'
    ? { type: 'json_object' as const }
    : value ?? { type: 'json_object' as const };
}

function parseProviderResult(body: unknown, model: string): ProviderResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, status: 502, error: 'provider_invalid_response' };
  }
  const message = (body as Record<string, unknown>).choices;
  const firstChoice = Array.isArray(message) ? message[0] : undefined;
  const assistantMessage =
    typeof firstChoice === 'object' && firstChoice !== null && !Array.isArray(firstChoice)
      ? (firstChoice as Record<string, unknown>).message
      : undefined;
  if (
    typeof assistantMessage !== 'object' || assistantMessage === null ||
    Array.isArray(assistantMessage)
  ) {
    return { ok: false, status: 502, error: 'provider_empty_response' };
  }
  const record = assistantMessage as Record<string, unknown>;
  const content = typeof record.content === 'string' && record.content.trim()
    ? record.content
    : null;
  const rawToolCalls = Array.isArray(record.tool_calls) ? record.tool_calls : [];
  const toolCalls = rawToolCalls.flatMap((call: unknown) => {
    if (typeof call !== 'object' || call === null || Array.isArray(call)) return [];
    const tool = call as Record<string, unknown>;
    const fn = tool.function;
    if (typeof fn !== 'object' || fn === null || Array.isArray(fn)) return [];
    const functionRecord = fn as Record<string, unknown>;
    return typeof tool.id === 'string' && typeof functionRecord.name === 'string' &&
        typeof functionRecord.arguments === 'string'
      ? [{ id: tool.id, name: functionRecord.name, arguments: functionRecord.arguments }]
      : [];
  });
  if (content === null && toolCalls.length === 0) {
    return { ok: false, status: 502, error: 'provider_empty_response' };
  }
  const responseBody = body as Record<string, unknown>;
  return {
    ok: true,
    content,
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
    model,
    ...(responseBody.usage !== undefined ? { usage: responseBody.usage } : {}),
  };
}

export type GroqAudioTranscriptionResult =
  | { ok: true; text: string | null }
  | { ok: false; status: number; error: string };

type GroqAudioConfiguration = Pick<
  ProviderConfiguration,
  'groqKey' | 'groqBaseUrl' | 'timeoutMs'
>;

export function createGroqAudioTranscriber(
  config: GroqAudioConfiguration,
  fetcher: typeof fetch = fetch,
): (url: string) => Promise<GroqAudioTranscriptionResult> {
  return async (url) => {
    const key = config.groqKey?.trim();
    if (!key) {
      return { ok: false, status: 503, error: 'groq_transcription_not_configured' };
    }

    const form = new FormData();
    form.set('url', url);
    form.set('model', GROQ_TRANSCRIPTION_PROFILE.model);
    form.set('response_format', 'json');

    let response: Response;
    try {
      const baseUrl = (config.groqBaseUrl ?? 'https://api.groq.com/openai/v1').replace(/\/$/, '');
      response = await fetcher(`${baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: form,
        signal: AbortSignal.timeout(config.timeoutMs ?? 60_000),
      });
    } catch {
      return { ok: false, status: 502, error: 'groq_transcription_unavailable' };
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { ok: false, status: 503, error: 'groq_transcription_not_configured' };
      }
      if (response.status === 429) {
        return { ok: false, status: 429, error: 'groq_transcription_rate_limited' };
      }
      if ([400, 413, 415, 422].includes(response.status)) {
        return { ok: false, status: 422, error: 'groq_transcription_rejected' };
      }
      return { ok: false, status: 502, error: 'groq_transcription_unavailable' };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { ok: false, status: 502, error: 'groq_transcription_invalid_response' };
    }
    if (
      typeof body !== 'object' || body === null || Array.isArray(body) ||
      typeof (body as Record<string, unknown>).text !== 'string'
    ) {
      return { ok: false, status: 502, error: 'groq_transcription_invalid_response' };
    }
    const text = ((body as Record<string, unknown>).text as string).trim().slice(0, 50_000);
    return { ok: true, text: text || null };
  };
}

export function createProviderCompleter(
  config: ProviderConfiguration,
  fetcher: typeof fetch = fetch,
): (input: ProviderCompletionInput) => Promise<ProviderResult> {
  const defaultProvider = config.projectDefaults?.provider ?? config.defaultProvider ??
    DEFAULT_AI_GATEWAY_PROVIDER;
  const projectDefaults = config.projectDefaults ?? {
    provider: defaultProvider,
    model: config.defaultModel ?? PROVIDER_DEFAULT_MODELS[defaultProvider],
  };

  return async (input) => {
    const flowConfig = resolveAiGatewayFlowConfig(input.flow, {
      provider: input.provider ?? projectDefaults.provider,
      model: input.model ?? projectDefaults.model,
    });
    const { provider, model } = flowConfig;
    const key = providerKey(provider, config);
    if (!key) return { ok: false, status: 503, error: 'provider_not_configured' };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    };
    if (provider === 'openrouter') {
      if (config.openRouterSiteUrl) headers['HTTP-Referer'] = config.openRouterSiteUrl;
      if (config.openRouterSiteName) headers['X-Title'] = config.openRouterSiteName;
    }
    const groqQwenJsonCompletion = flowConfig.reasoning.groq !== undefined &&
      input.responseFormat !== null &&
      !input.tools?.length;
    const body = {
      model,
      messages: input.messages,
      ...(provider === 'groq'
        ? { max_completion_tokens: flowConfig.maxTokens }
        : { max_tokens: flowConfig.maxTokens }),
      ...((input.responseFormat === null || input.tools?.length)
        ? {}
        : { response_format: normalizedResponseFormat(input.responseFormat) }),
      ...(groqQwenJsonCompletion ? flowConfig.reasoning.groq : {}),
      ...(input.tools ? { tools: input.tools, tool_choice: 'auto' } : {}),
      ...(provider === 'openrouter' ? { usage: { include: true } } : {}),
      ...(provider === 'openrouter' && flowConfig.reasoning.openrouter
        ? { reasoning: flowConfig.reasoning.openrouter }
        : {}),
    };

    let response: Response;
    try {
      response = await fetcher(`${providerBaseUrl(provider, config)}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.timeoutMs ?? 45_000),
      });
    } catch {
      return { ok: false, status: 502, error: 'provider_unavailable' };
    }
    if (!response.ok) {
      return {
        ok: false,
        status: 502,
        error: response.status === 429 ? 'provider_rate_limited' : 'provider_request_failed',
      };
    }
    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch {
      console.warn(JSON.stringify({
        event: 'ai_provider_response_unusable',
        provider,
        model,
        status: response.status,
        contentType: response.headers.get('content-type'),
        reason: 'invalid_json',
      }));
      return { ok: false, status: 502, error: 'provider_invalid_response' };
    }
    const result = parseProviderResult(responseBody, model);
    if (!result.ok) {
      console.warn(JSON.stringify({
        event: 'ai_provider_response_unusable',
        provider,
        model,
        status: response.status,
        contentType: response.headers.get('content-type'),
        reason: result.error,
        responseKind: Array.isArray(responseBody) ? 'array' : typeof responseBody,
      }));
    }
    return result;
  };
}
