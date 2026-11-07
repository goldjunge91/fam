import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import { json, withRequestId } from './http.ts';

Deno.test('adds one request ID to the JSON error body, header, and server log', async () => {
  const logs: string[] = [];
  const originalInfo = console.info;
  console.info = (...values: unknown[]) => logs.push(values.join(' '));

  try {
    const handler = withRequestId(
      'test-function',
      () => json({ error: 'database_failed', message: 'raw database detail' }, 500),
    );
    const response = await handler(
      new Request('https://example.test/function', { method: 'POST' }),
    );
    const body = await response.json();
    const requestId = response.headers.get('X-Request-Id');

    assert(requestId);
    assertEquals(body, { error: 'database_failed', requestId });
    assertEquals(response.status, 500);
    assertStringIncludes(logs.join('\n'), requestId);
    assertStringIncludes(logs.join('\n'), 'database_failed');
    assert(!JSON.stringify(body).includes('raw database detail'));
  } finally {
    console.info = originalInfo;
  }
});

Deno.test('turns an unhandled exception into a safe, correlated server error', async () => {
  const errors: string[] = [];
  const logs: string[] = [];
  const originalError = console.error;
  const originalInfo = console.info;
  console.error = (...values: unknown[]) => errors.push(values.join(' '));
  console.info = (...values: unknown[]) => logs.push(values.join(' '));

  try {
    const handler = withRequestId('test-function', () => {
      throw new Error('raw internal detail');
    });
    const response = await handler(new Request('https://example.test/function', { method: 'GET' }));
    const body = await response.json();
    const requestId = response.headers.get('X-Request-Id');

    assert(requestId);
    assertEquals(body, { error: 'internal_error', requestId });
    assertStringIncludes(errors.join('\n'), requestId);
    assertStringIncludes(logs.join('\n'), requestId);
    assert(!errors.join('\n').includes('raw internal detail'));
    assert(!JSON.stringify(body).includes('raw internal detail'));
  } finally {
    console.error = originalError;
    console.info = originalInfo;
  }
});

Deno.test('preserves each HTTP status while stamping successful and error JSON responses', async () => {
  for (const status of [200, 400, 401, 403, 500]) {
    const handler = withRequestId(
      'test-function',
      () =>
        json(
          status >= 400 ? { error: `status_${status}`, message: 'private detail' } : { ok: true },
          status,
        ),
    );
    const response = await handler(new Request('https://example.test/function', { method: 'GET' }));
    const body = await response.json();
    const requestId = response.headers.get('X-Request-Id');

    assert(requestId);
    assertEquals(response.status, status);
    assertEquals(body.requestId, requestId);
    assertEquals(body.error, status >= 400 ? `status_${status}` : undefined);
    assert(!JSON.stringify(body).includes('private detail'));
  }
});
