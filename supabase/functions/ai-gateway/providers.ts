import type { GatewayProvider, ProviderMessage, ProviderResult, ProviderTool } from './handler.ts';

export type ProviderCompletionInput = {
  provider?: GatewayProvider;
  model: string;
  messages: ProviderMessage[];
  tools?: ProviderTool[];
  responseFormat?: 'json_object' | null;
  maxTokens?: number;
};

export type ProviderConfiguration = {
  defaultProvider: GatewayProvider;
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

export function createProviderCompleter(
  config: ProviderConfiguration,
  fetcher: typeof fetch = fetch,
): (input: ProviderCompletionInput) => Promise<ProviderResult> {
  return async (input) => {
    const provider = input.provider ?? config.defaultProvider;
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
    const body = {
      model: input.model,
      messages: input.messages,
      ...(provider === 'groq'
        ? { max_completion_tokens: input.maxTokens ?? 1_536 }
        : { max_tokens: input.maxTokens ?? 1_536 }),
      ...(input.responseFormat === null
        ? {}
        : { response_format: { type: input.responseFormat ?? 'json_object' } }),
      ...(input.tools ? { tools: input.tools, tool_choice: 'auto' } : {}),
      ...(provider === 'openrouter' ? { usage: { include: true } } : {}),
      ...(provider === 'openrouter' && input.model === 'ibm-granite/granite-4.2-8b'
        ? { reasoning: { enabled: false } }
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
    try {
      return parseProviderResult(await response.json(), input.model);
    } catch {
      return { ok: false, status: 502, error: 'provider_invalid_response' };
    }
  };
}
