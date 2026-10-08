import { describe, expect, it } from '@jest/globals';
import { createBrochureImageHandler } from '../../supabase/functions/brochure-image/handler';

function setup() {
  const presignedKeys: string[] = [];
  const handler = createBrochureImageHandler({
    authenticate: async (request) =>
      request.headers.get('Authorization')
        ? { ok: true, userId: 'user-1' }
        : { ok: false, status: 401, error: 'missing_authorization' },
    getSignedUrl: async (key) => {
      presignedKeys.push(key);
      return { ok: true, url: `https://r2.example.test/${key}?sig=1`, expiresAt: '2026-10-07T12:01:00Z' };
    },
  });

  return { handler, presignedKeys };
}

describe('brochure image handler', () => {
  it('rejects unauthenticated requests before signing an image key', async () => {
    const { handler, presignedKeys } = setup();
    const response = await handler(
      new Request('http://localhost/brochure-image?key=brochures%2Fdumps%2Fassets%2Fa.jpg'),
    );

    expect(response.status).toBe(401);
    expect(presignedKeys).toEqual([]);
  });

  it('signs only an authorized brochure key and redirects to its short-lived URL', async () => {
    const { handler, presignedKeys } = setup();
    const response = await handler(
      new Request('http://localhost/brochure-image?key=brochures%2Fdumps%2Fassets%2Fa.jpg', {
        headers: { Authorization: 'Bearer user-token' },
      }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(
      'https://r2.example.test/brochures/dumps/assets/a.jpg?sig=1',
    );
    expect(presignedKeys).toEqual(['brochures/dumps/assets/a.jpg']);
  });

  it('rejects path traversal before requesting a signed URL', async () => {
    const { handler, presignedKeys } = setup();
    const response = await handler(
      new Request(
        'http://localhost/brochure-image?key=brochures%2Fdumps%2F..%2F..%2Fsecret.jpg',
        { headers: { Authorization: 'Bearer user-token' } },
      ),
    );

    expect(response.status).toBe(400);
    expect(presignedKeys).toEqual([]);
  });
});
