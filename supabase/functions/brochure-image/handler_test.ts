import { assertEquals } from 'jsr:@std/assert@1';

import { createBrochureImageHandler, type ResolvedAsset } from './handler.ts';

function setup(options: { cached?: ArrayBuffer; expired?: boolean } = {}) {
  const cache = new Map<string, { body: ArrayBuffer; contentType: string }>();
  if (options.cached) {
    cache.set('brochures/demand/test.img', {
      body: options.cached,
      contentType: 'image/jpeg',
    });
  }
  let sourceCalls = 0;
  const source = new TextEncoder().encode('source image').buffer;
  const handler = createBrochureImageHandler({
    authenticate: (request) =>
      Promise.resolve(
        request.headers.get('Authorization')
          ? { ok: true, userId: 'user-1' }
          : { ok: false, status: 401, error: 'missing_authorization' },
      ),
    resolveAsset: () =>
      Promise.resolve(
        {
          ok: true,
          sourceUrl: 'https://offerscdn.bringapi.app/content/page.jpg',
          cacheKey: 'brochures/demand/test.img',
          expiresAt: options.expired ? '2026-10-24T23:59:00.000Z' : '2099-10-07T00:00:00.000Z',
        } satisfies ResolvedAsset,
      ),
    getCached: (key) => Promise.resolve(cache.get(key) ?? null),
    fetchSource: () => {
      sourceCalls += 1;
      return Promise.resolve(
        new Response(source, {
          headers: { 'content-type': 'image/jpeg' },
        }),
      );
    },
    putCached: (key, body, contentType) => {
      if (cache.has(key)) return Promise.resolve('already-existed');
      cache.set(key, { body, contentType });
      return Promise.resolve('stored');
    },
    now: () => Date.parse('2026-10-25T00:00:00.000Z'),
  });
  return { handler, cache, sourceCalls: () => sourceCalls };
}

Deno.test('authenticates before resolving a brochure image', async () => {
  const { handler } = setup();
  const response = await handler(
    new Request('http://localhost/brochure-image?asset=cover&brochure_id=edition-1'),
  );
  assertEquals(response.status, 401);
});

Deno.test('rejects arbitrary source URLs', async () => {
  const { handler, sourceCalls } = setup();
  const response = await handler(
    new Request(
      'http://localhost/brochure-image?asset=url&url=https%3A%2F%2Fofferscdn.bringapi.app%2Fcontent%2Fpage.jpg',
      { headers: { Authorization: 'Bearer user-token' } },
    ),
  );
  assertEquals(response.status, 400);
  assertEquals(sourceCalls(), 0);
});

Deno.test('stores a cache miss and serves a later hit without fetching Bring', async () => {
  const { handler, cache, sourceCalls } = setup();
  const request = () =>
    new Request(
      'http://localhost/brochure-image?asset=cover&brochure_id=edition-1',
      { headers: { Authorization: 'Bearer user-token' } },
    );

  const miss = await handler(request());
  assertEquals(miss.status, 200);
  assertEquals(await miss.text(), 'source image');
  assertEquals(cache.has('brochures/demand/test.img'), true);

  const hit = await handler(request());
  assertEquals(hit.status, 200);
  assertEquals(await hit.text(), 'source image');
  assertEquals(sourceCalls(), 1);
});

Deno.test('does not refill an expired brochure', async () => {
  const { handler, sourceCalls } = setup({ expired: true });
  const response = await handler(
    new Request(
      'http://localhost/brochure-image?asset=cover&brochure_id=edition-1',
      { headers: { Authorization: 'Bearer user-token' } },
    ),
  );
  assertEquals(response.status, 410);
  assertEquals(sourceCalls(), 0);
});
