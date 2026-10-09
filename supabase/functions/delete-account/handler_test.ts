import { deepStrictEqual as assertEquals } from 'node:assert';

import { createDeleteAccountHandler, type DbError, LAST_ADMIN_SQLSTATE } from './handler.ts';

const AUTH = 'Bearer test-token';
const USER_ID = 'user-1';

function setup(
  {
    userId = USER_ID,
    prepareError = null,
    deleteError = null,
  }: {
    userId?: string | null;
    prepareError?: DbError | null;
    deleteError?: DbError | null;
  } = {},
) {
  const calls: string[] = [];
  const handler = createDeleteAccountHandler({
    getUserId: () => Promise.resolve(userId),
    prepareDeletion: () => {
      calls.push('prepare');
      return Promise.resolve(prepareError);
    },
    deleteUser: (id) => {
      calls.push(`delete:${id}`);
      return Promise.resolve(deleteError);
    },
  });
  return { handler, calls };
}

const post = (headers: HeadersInit = { Authorization: AUTH }) =>
  new Request('http://localhost/delete-account', { method: 'POST', headers });

Deno.test('rejects non-POST requests', async () => {
  const { handler, calls } = setup();
  const res = await handler(new Request('http://localhost/delete-account'));
  assertEquals(res.status, 405);
  assertEquals(calls, []);
});

Deno.test('returns 401 without Authorization header', async () => {
  const { handler, calls } = setup();
  const res = await handler(post({}));
  assertEquals(res.status, 401);
  assertEquals(await res.json(), { error: 'missing_authorization' });
  assertEquals(calls, []);
});

Deno.test('returns 401 for an invalid token', async () => {
  const { handler, calls } = setup({ userId: null });
  assertEquals((await handler(post())).status, 401);
  assertEquals(calls, []);
});

Deno.test('returns 409 for the stable last-admin SQLSTATE without deleting the user', async () => {
  const { handler, calls } = setup({
    prepareError: { message: 'database rejected the deletion', code: LAST_ADMIN_SQLSTATE },
  });
  const res = await handler(post());
  assertEquals(res.status, 409);
  assertEquals(await res.json(), { error: 'last_admin_with_members' });
  assertEquals(calls, ['prepare']);
});

Deno.test('does not classify a SQL error from its message text', async () => {
  const { handler, calls } = setup({
    prepareError: { message: 'last_admin_with_members: household (id)', code: 'P0001' },
  });
  const res = await handler(post());
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: 'prepare_failed' });
  assertEquals(calls, ['prepare']);
});

Deno.test('hides internal error details when prepare fails', async () => {
  const { handler, calls } = setup({ prepareError: { message: 'relation "x" does not exist' } });
  const res = await handler(post());
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: 'prepare_failed' });
  assertEquals(calls, ['prepare']);
});

Deno.test('hides internal error details when the admin delete fails', async () => {
  const { handler, calls } = setup({ deleteError: { message: 'boom' } });
  const res = await handler(post());
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: 'delete_failed' });
  assertEquals(calls, ['prepare', `delete:${USER_ID}`]);
});

Deno.test('deletes exactly the authenticated user after prepare succeeds', async () => {
  const { handler, calls } = setup();
  const res = await handler(post());
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { success: true });
  assertEquals(calls, ['prepare', `delete:${USER_ID}`]);
});
