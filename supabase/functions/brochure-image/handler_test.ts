import { assert, assertEquals } from 'jsr:@std/assert@1';

import { createBrochureImageHandler } from './handler.ts';

type SetupOptions = { signedFail?: boolean };

function request(url: string, options: RequestInit = {}) {
  return new Request(url, options);
}

function setup(options: SetupOptions = {}) {
  let authenticated = 0;
  let presigned = 0;
  const presignInputs: string[] = [];
  const handler = createBrochureImageHandler({
    authenticate: async (request) => {
      authenticated += 1;
      return request.headers.get('Authorization')
        ? { ok: true, userId: 'user-1' }
        : { ok: false, status: 401, error: 'missing_authorization' };
    },
    getSignedUrl: async (key) => {
      presigned += 1;
      presignInputs.push(key);
      if (options.signedFail) {
        return { ok: false, status: 503, error: 'r2_not_configured' };
      }
      return { ok: true, url: 'https://r2.example.test/' + key + '?sig=1', expiresAt: '2026-01-01T00:01:00Z' };
    },
  });
  return { handler, counts: () => ({ authenticated, presigned, presignInputs }) };
}

Deno.test('rejects requests without authorization before presigning', async () => {
  const { handler, counts } = setup();
  const response = await handler(
    request('http://localhost/brochure-image?key=brochures%2Fdumps%2Fassets%2Fa.jpg'),
  );
  assertEquals(response.status, 401);
  assertEquals((await response.json()).error, 'missing_authorization');
  assertEquals(counts().presigned, 0);
});

Deno.test('rejects keys outside the brochure prefix', async () => {
  const { handler, counts } = setup();
  const response = await handler(
    request('http://localhost/brochure-image?key=other%2Fsecret.jpg', {
      headers: { Authorization: 'Bearer user-token' },
    }),
  );
  assertEquals(response.status, 400);
  assertEquals((await response.json()).error, 'invalid_key');
  assertEquals(counts().presigned, 0);
});

Deno.test('rejects path traversal attempts', async () => {
  const { handler, counts } = setup();
  const response = await handler(
    request('http://localhost/brochure-image?key=brochures%2Fdumps%2F..%2F..%2Fsecret.jpg', {
      headers: { Authorization: 'Bearer user-token' },
    }),
  );
  assertEquals(response.status, 400);
  assertEquals((await response.json()).error, 'invalid_key');
  assertEquals(counts().presigned, 0);
});

Deno.test('redirects authorized brochure keys to the signed URL', async () => {
  const { handler, counts } = setup();
  const response = await handler(
    request('http://localhost/brochure-image?key=brochures%2Fdumps%2Fassets%2Fabc.jpg', {
      headers: { Authorization: 'Bearer user-token' },
    }),
  );
  assertEquals(response.status, 302);
  assertEquals(
    response.headers.get('Location'),
    'https://r2.example.test/brochures/dumps/assets/abc.jpg?sig=1',
  );
  assertEquals(counts().presignInputs, ['brochures/dumps/assets/abc.jpg']);
});

Deno.test('maps presign failures to a structured error', async () => {
  const { handler } = setup({ signedFail: true });
  const response = await handler(
    request('http://localhost/brochure-image?key=brochures%2Fdumps%2Fassets%2Fabc.jpg', {
      headers: { Authorization: 'Bearer user-token' },
    }),
  );
  assertEquals(response.status, 503);
  assertEquals((await response.json()).error, 'r2_not_configured');
});
