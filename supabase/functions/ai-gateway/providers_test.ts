import { assertEquals } from 'jsr:@std/assert@1';

import { createProviderCompleter } from './providers.ts';

function okResponse(overrides: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: 'Antwort vom Modell' } }],
      usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
      ...overrides,
    }),
    { status: 200 },
  );
}

Deno.test('sends OpenRouter requests with existing JSON mode and attribution headers', async () => {
  let url = '';
  let init: RequestInit | undefined;
  const complete = createProviderCompleter({
    defaultProvider: 'openrouter',
    openRouterKey: 'openrouter-test-key',
    openRouterBaseUrl: 'https://openrouter.example/api/v1/',
    openRouterSiteUrl: 'https://fam.example',
    openRouterSiteName: 'fam',
  }, async (nextUrl, nextInit) => {
    url = String(nextUrl);
    init = nextInit;
    return okResponse();
  });

  const result = await complete({
    model: 'z-ai/glm-5.3-flash',
    messages: [{ role: 'user', content: 'Hallo' }],
  });

  assertEquals(url, 'https://openrouter.example/api/v1/chat/completions');
  assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer openrouter-test-key');
  assertEquals(new Headers(init?.headers).get('HTTP-Referer'), 'https://fam.example');
  assertEquals(new Headers(init?.headers).get('X-Title'), 'fam');
  assertEquals(JSON.parse(String(init?.body)), {
    model: 'z-ai/glm-5.3-flash',
    messages: [{ role: 'user', content: 'Hallo' }],
    max_tokens: 1536,
    response_format: { type: 'json_object' },
    usage: { include: true },
  });
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.model, 'z-ai/glm-5.3-flash');
    assertEquals(result.content, 'Antwort vom Modell');
    assertEquals(result.usage, { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 });
  }
});

Deno.test('routes Groq tool calls through its OpenAI-compatible endpoint and token parameter', async () => {
  let url = '';
  let init: RequestInit | undefined;
  const complete = createProviderCompleter({
    defaultProvider: 'openrouter',
    groqKey: 'groq-test-key',
  }, async (nextUrl, nextInit) => {
    url = String(nextUrl);
    init = nextInit;
    return okResponse({
      choices: [{
        message: {
          content: null,
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: { name: 'get_inventory', arguments: '{}' },
          }],
        },
      }],
    });
  });

  const result = await complete({
    provider: 'groq',
    model: 'qwen/qwen3.8-27b',
    messages: [{ role: 'user', content: 'Was ist noch im Vorrat?' }],
    tools: [{
      type: 'function',
      function: {
        name: 'get_inventory',
        description: 'Read inventory',
        parameters: {},
      },
    }],
  });

  assertEquals(url, 'https://api.groq.com/openai/v1/chat/completions');
  assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer groq-test-key');
  const body = JSON.parse(String(init?.body));
  assertEquals(body.model, 'qwen/qwen3.8-27b');
  assertEquals(body.max_completion_tokens, 1536);
  assertEquals(body.response_format, { type: 'json_object' });
  assertEquals(body.tools[0].function.name, 'get_inventory');
  assertEquals(body.tool_choice, 'auto');
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.content, null);
    assertEquals(result.toolCalls, [{ id: 'call-1', name: 'get_inventory', arguments: '{}' }]);
  }
});

Deno.test('omits JSON mode for plain text model tests and reports a missing provider key', async () => {
  let init: RequestInit | undefined;
  const withKey = createProviderCompleter({
    defaultProvider: 'groq',
    groqKey: 'groq-test-key',
  }, async (_url, nextInit) => {
    init = nextInit;
    return okResponse();
  });
  const result = await withKey({
    model: 'openai/gpt-oss-120b',
    messages: [{ role: 'user', content: 'Test' }],
    responseFormat: null,
    maxTokens: 1024,
  });
  assertEquals(result.ok, true);
  assertEquals('response_format' in JSON.parse(String(init?.body)), false);
  assertEquals(JSON.parse(String(init?.body)).max_completion_tokens, 1024);

  let called = false;
  const withoutKey = createProviderCompleter({
    defaultProvider: 'groq',
  }, async () => {
    called = true;
    return okResponse();
  });
  const missing = await withoutKey({
    provider: 'groq',
    model: 'qwen/qwen3.8-27b',
    messages: [{ role: 'user', content: 'Test' }],
  });
  assertEquals(missing, { ok: false, status: 503, error: 'provider_not_configured' });
  assertEquals(called, false);
});

Deno.test('normalizes provider request failures without leaking upstream response bodies', async () => {
  const complete = createProviderCompleter({
    defaultProvider: 'groq',
    groqKey: 'groq-test-key',
  }, async () => new Response('secret upstream details', { status: 401 }));

  const result = await complete({
    model: 'qwen/qwen3.8-27b',
    messages: [{ role: 'user', content: 'Test' }],
  });
  assertEquals(result, { ok: false, status: 502, error: 'provider_request_failed' });
});

Deno.test('logs safe metadata when a successful provider response is not JSON', async () => {
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = ((...values: unknown[]) => {
    warnings.push(values.map(String).join(' '));
  }) as typeof console.warn;
  try {
    const complete = createProviderCompleter({
      defaultProvider: 'openrouter',
      openRouterKey: 'openrouter-test-key',
    }, async () =>
      new Response('private provider response', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }));
    const result = await complete({
      model: 'z-ai/glm-5.3-flash',
      messages: [{ role: 'user', content: 'private prompt' }],
    });
    assertEquals(result, { ok: false, status: 502, error: 'provider_invalid_response' });
  } finally {
    console.warn = originalWarn;
  }

  assertEquals(warnings.length, 1);
  assertEquals(warnings[0]?.includes('ai_provider_response_unusable'), true);
  assertEquals(warnings[0]?.includes('invalid_json'), true);
  assertEquals(warnings[0]?.includes('text/html'), true);
  assertEquals(warnings[0]?.includes('private prompt'), false);
  assertEquals(warnings[0]?.includes('private provider response'), false);
});

Deno.test('normalizes fetch throws and upstream status failures without exposing provider details', async () => {
  const thrown = createProviderCompleter({
    defaultProvider: 'groq',
    groqKey: 'groq-test-key',
  }, async () => {
    throw new Error('private upstream failure');
  });
  assertEquals(await thrown({
    model: 'qwen/qwen3.8-27b',
    messages: [{ role: 'user', content: 'Test' }],
  }), { ok: false, status: 502, error: 'provider_unavailable' });

  for (const [status, error] of [[429, 'provider_rate_limited'], [503, 'provider_request_failed']] as const) {
    const complete = createProviderCompleter({
      defaultProvider: 'openrouter',
      openRouterKey: 'openrouter-test-key',
    }, async () => new Response('private upstream body', { status }));
    assertEquals(await complete({
      model: 'z-ai/glm-5.3-flash',
      messages: [{ role: 'user', content: 'Test' }],
    }), { ok: false, status: 502, error });
  }
});

Deno.test('fails closed for empty, non-object, and malformed tool-call responses', async () => {
  const bodies: unknown[] = [
    [],
    { choices: [] },
    { choices: [{ message: null }] },
    { choices: [{ message: { content: '' } }] },
    {
      choices: [{
        message: {
          content: null,
          tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'get_inventory' } }],
        },
      }],
    },
  ];
  for (const body of bodies) {
    const complete = createProviderCompleter({
      defaultProvider: 'openrouter',
      openRouterKey: 'openrouter-test-key',
    }, async () => new Response(JSON.stringify(body), { status: 200 }));
    const result = await complete({
      model: 'z-ai/glm-5.3-flash',
      messages: [{ role: 'user', content: 'Test' }],
    });
    assertEquals(result, { ok: false, status: 502, error: body instanceof Array ? 'provider_invalid_response' : 'provider_empty_response' });
  }

  const mixedToolCalls = createProviderCompleter({
    defaultProvider: 'openrouter',
    openRouterKey: 'openrouter-test-key',
  }, async () => new Response(JSON.stringify({
    choices: [{
      message: {
        content: 'Fallback-Antwort',
        tool_calls: [
          { id: 'valid', function: { name: 'get_inventory', arguments: '{}' } },
          { id: 'broken', function: { name: 'get_inventory' } },
        ],
      },
    }],
  }), { status: 200 }));
  const mixed = await mixedToolCalls({
    model: 'z-ai/glm-5.3-flash',
    messages: [{ role: 'user', content: 'Test' }],
  });
  assertEquals(mixed, {
    ok: true,
    content: 'Fallback-Antwort',
    toolCalls: [{ id: 'valid', name: 'get_inventory', arguments: '{}' }],
    model: 'z-ai/glm-5.3-flash',
  });
});

Deno.test('keeps provider-specific token and JSON options bounded for both providers', async () => {
  let openRouterBody: Record<string, unknown> | null = null;
  const openRouter = createProviderCompleter({
    defaultProvider: 'openrouter',
    openRouterKey: 'openrouter-test-key',
  }, async (_url, init) => {
    openRouterBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return okResponse();
  });
  await openRouter({
    model: 'ibm-granite/granite-4.2-8b',
    messages: [{ role: 'user', content: 'Test' }],
    maxTokens: 77,
  });
  assertEquals(openRouterBody, {
    model: 'ibm-granite/granite-4.2-8b',
    messages: [{ role: 'user', content: 'Test' }],
    max_tokens: 77,
    response_format: { type: 'json_object' },
    usage: { include: true },
    reasoning: { enabled: false },
  });

  let groqBody: Record<string, unknown> | null = null;
  const groq = createProviderCompleter({
    defaultProvider: 'groq',
    groqKey: 'groq-test-key',
  }, async (_url, init) => {
    groqBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return okResponse();
  });
  await groq({
    model: 'qwen/qwen3.8-27b',
    messages: [{ role: 'user', content: 'Test' }],
    responseFormat: null,
    maxTokens: 88,
  });
  assertEquals(groqBody, {
    model: 'qwen/qwen3.8-27b',
    messages: [{ role: 'user', content: 'Test' }],
    max_completion_tokens: 88,
  });
});
