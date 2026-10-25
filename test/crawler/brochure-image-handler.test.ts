import { describe, expect, it } from '@jest/globals';
import { createBrochureImageHandler, type ResolvedAsset } from '../../supabase/functions/brochure-image/handler';

function setup(options: { cached?: ArrayBuffer } = {}) {
  const cache = new Map<string, { body: ArrayBuffer; contentType: string }>();
  if (options.cached) cache.set('brochures/demand/key.img', { body: options.cached, contentType: 'image/jpeg' });
  const source = new TextEncoder().encode('source image').buffer;
  let sourceCalls = 0;
  const handler = createBrochureImageHandler({
    authenticate: async (request) => request.headers.get('Authorization')
      ? { ok: true, userId: 'user-1' }
      : { ok: false, status: 401, error: 'missing_authorization' },
    resolveAsset: async () => ({
      ok: true,
      sourceUrl: 'https://cdn.bringapi.app/content/page.jpg',
      cacheKey: 'brochures/demand/key.img',
      expiresAt: '2099-10-07T00:00:00.000Z',
    } satisfies ResolvedAsset),
    getCached: async (key) => cache.get(key) ?? null,
    fetchSource: async () => {
      sourceCalls += 1;
      return new Response(source, { status: 200, headers: { 'content-type': 'image/jpeg' } });
    },
    putCached: async (key, body, contentType) => {
      if (cache.has(key)) return 'already-existed';
      cache.set(key, { body, contentType });
      return 'stored';
    },
    now: () => Date.parse('2026-10-25T00:00:00.000Z'),
  });
  return { handler, cache, sourceCalls: () => sourceCalls };
}

describe('brochure image demand cache', () => {
  it('authenticates before resolving an asset', async () => {
    const { handler } = setup();
    const response = await handler(new Request('http://localhost/brochure-image?asset=cover&brochure_id=brochure-1'));
    expect(response.status).toBe(401);
  });

  it('loads a missing source once, stores it, and returns the image', async () => {
    const { handler, cache, sourceCalls } = setup();
    const response = await handler(new Request(
      'http://localhost/brochure-image?asset=cover&brochure_id=brochure-1',
      { headers: { Authorization: 'Bearer user-token' } },
    ));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(await response.text()).toBe('source image');
    expect(sourceCalls()).toBe(1);
    expect(cache.has('brochures/demand/key.img')).toBe(true);
  });

  it('serves a cache hit without contacting Bring', async () => {
    const { handler, sourceCalls } = setup({ cached: new TextEncoder().encode('cached image').buffer });
    const response = await handler(new Request(
      'http://localhost/brochure-image?asset=page&page_number=1&brochure_id=brochure-1',
      { headers: { Authorization: 'Bearer user-token' } },
    ));

    expect(await response.text()).toBe('cached image');
    expect(sourceCalls()).toBe(0);
  });

  it('rejects arbitrary URLs and unsupported asset roles', async () => {
    const { handler } = setup();
    const response = await handler(new Request(
      'http://localhost/brochure-image?asset=url&url=https%3A%2F%2Fcdn.bringapi.app%2Fcontent%2Fa.jpg',
      { headers: { Authorization: 'Bearer user-token' } },
    ));
    expect(response.status).toBe(400);
  });
});
