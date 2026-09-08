import { assertEquals } from 'jsr:@std/assert@1';
import { createDeleteAccountHandler, type DeleteAccountDependencies } from './handler.ts';

function createRequest(options: { method?: string; auth?: string } = {}) {
  const { method = 'POST', auth = 'Bearer valid-token' } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) headers['Authorization'] = auth;
  return new Request('http://localhost/delete-account', { method, headers });
}

function setup(overrides: Partial<DeleteAccountDependencies> = {}) {
  const defaults: DeleteAccountDependencies = {
    authenticate: async (header) =>
      header === 'Bearer valid-token'
        ? { ok: true, user: { id: 'user-123' } }
        : { ok: false, status: 401, error: 'unauthorized' },
    checkRequestLimit: async () => ({ allowed: true, retryAfter: null }),
    prepareAccountDeletion: async () => ({ error: null }),
    deleteUser: async () => ({ error: null }),
  };
  return createDeleteAccountHandler({ ...defaults, ...overrides });
}

Deno.test('delete-account: responds to OPTIONS preflight with 204 and CORS headers', async () => {
  const handler = setup();
  const res = await handler(new Request('http://localhost/delete-account', { method: 'OPTIONS' }));
  assertEquals(res.status, 204);
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(res.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  assertEquals(res.headers.get('Access-Control-Allow-Headers'), 'authorization, x-client-info, apikey, content-type');
});

Deno.test('delete-account: rejects non-POST requests with 405', async () => {
  const handler = setup();
  const res = await handler(new Request('http://localhost/delete-account', { method: 'GET' }));
  assertEquals(res.status, 405);
  assertEquals(await res.json(), { error: 'method_not_allowed' });
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), '*');
});

Deno.test('delete-account: rejects missing Authorization header with 401', async () => {
  const handler = setup();
  const res = await handler(new Request('http://localhost/delete-account', { method: 'POST' }));
  assertEquals(res.status, 401);
  assertEquals(await res.json(), { error: 'missing_authorization' });
});

Deno.test('delete-account: rejects invalid token with 401', async () => {
  const handler = setup();
  const res = await handler(createRequest({ auth: 'Bearer invalid-token' }));
  assertEquals(res.status, 401);
  assertEquals(await res.json(), { error: 'unauthorized' });
});

Deno.test('delete-account: returns 429 with Retry-After when rate limit is exceeded', async () => {
  const handler = setup({
    checkRequestLimit: async () => ({ allowed: false, retryAfter: 42 }),
  });
  const res = await handler(createRequest());
  assertEquals(res.status, 429);
  assertEquals(res.headers.get('Retry-After'), '42');
  const body = await res.json();
  assertEquals(body.error, 'rate_limited');
});

Deno.test('delete-account: returns 409 when user is last admin with members', async () => {
  const handler = setup({
    prepareAccountDeletion: async () => ({
      error: { message: 'last_admin_with_members: transfer admin role first' },
    }),
  });
  const res = await handler(createRequest());
  assertEquals(res.status, 409);
  const body = await res.json();
  assertEquals(body.error, 'last_admin_with_members');
});

Deno.test('delete-account: returns masked 500 when prepare fails with other error', async () => {
  const handler = setup({
    prepareAccountDeletion: async () => ({
      error: { message: 'internal db timeout on prepare' },
    }),
  });
  const res = await handler(createRequest());
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, 'prepare_failed');
  assertEquals(body.message, 'Konto konnte nicht zur Löschung vorbereitet werden.');
});

Deno.test('delete-account: returns masked 500 when deleteUser fails', async () => {
  const handler = setup({
    deleteUser: async () => ({
      error: { message: 'admin delete user failed' },
    }),
  });
  const res = await handler(createRequest());
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, 'delete_failed');
  assertEquals(body.message, 'Löschung fehlgeschlagen.');
});

Deno.test('delete-account: returns 200 on successful deletion', async () => {
  let deletedId = '';
  const handler = setup({
    deleteUser: async (id) => {
      deletedId = id;
      return { error: null };
    },
  });
  const res = await handler(createRequest());
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { success: true });
  assertEquals(deletedId, 'user-123');
});
