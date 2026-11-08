import { assertEquals } from 'jsr:@std/assert@1';

import { createProviderCompleter } from './providers.ts';

function okResponse(overrides: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { content: 'Antwort vom Modell' } }],
    usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
    ...overrides,
  }), { status: 200 });
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
      choices: [{ message: {
        content: null,
        tool_calls: [{
          id: 'call-1',
          type: 'function',
          function: { name: 'get_inventory', arguments: '{}' },
        }],
      } }],
    });
  });

  const result = await complete({
    provider: 'groq',
    model: 'qwen/qwen3.8-27b',
    messages: [{ role: 'user', content: 'Was ist noch im Vorrat?' }],
    tools: [{ type: 'function', function: {
      name: 'get_inventory', description: 'Read inventory', parameters: {},
    } }],
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
