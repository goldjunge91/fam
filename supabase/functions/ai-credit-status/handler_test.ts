import { assert, assertEquals } from 'jsr:@std/assert@1';

import { AI_CREDIT_LIMIT, createAiCreditStatusHandler, mapAiCreditStatus } from './handler.ts';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const HOUSEHOLD_ONE = '22222222-2222-4222-8222-222222222222';
const HOUSEHOLD_TWO = '33333333-3333-4333-8333-333333333333';
const AUTHORIZATION = 'Bearer valid-user-token';

function request(body: unknown = {}) {
  return new Request('https://example.test/ai-credit-status', {
    method: 'POST',
    headers: {
      Authorization: AUTHORIZATION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function setup(options: {
  householdIds?: string[];
  rows?: Record<string, unknown>;
  authenticated?: boolean;
  memberLookupFails?: boolean;
  statusReadFails?: boolean;
} = {}) {
  const authCalls: Array<{ authorization: string; requestId: string }> = [];
  const memberCalls: Array<{ userId: string; authorization: string; requestId: string }> = [];
  const statusCalls: Array<{ householdId: string; requestId: string }> = [];
  const handler = createAiCreditStatusHandler({
    authenticate: (authorization, requestId) => {
      authCalls.push({ authorization, requestId });
      return Promise.resolve(
        options.authenticated === false
          ? { ok: false as const, status: 401 as const, error: 'unauthorized' as const }
          : { ok: true as const, userId: USER_ID },
      );
    },
    listHouseholdIds: (userId, authorization, requestId) => {
      memberCalls.push({ userId, authorization, requestId });
      return Promise.resolve(
        options.memberLookupFails
          ? { ok: false as const }
          : { ok: true as const, householdIds: options.householdIds ?? [] },
      );
    },
    readStatus: (householdId, requestId) => {
      statusCalls.push({ householdId, requestId });
      if (options.statusReadFails) return Promise.resolve({ ok: false as const });
      return Promise.resolve({
        ok: true as const,
        row: {
          credits_used: 30,
          credits_remaining: 70,
          credit_limit: AI_CREDIT_LIMIT,
          warning_reached: false,
          blocked: false,
          ...options.rows,
        },
      });
    },
  });
  return { handler, authCalls, memberCalls, statusCalls };
}

Deno.test('maps the fixed 100-credit server row to the mobile response shape', () => {
  assertEquals(
    mapAiCreditStatus(HOUSEHOLD_ONE, {
      credits_used: 97,
      credits_remaining: 3,
      credit_limit: 100,
      warning_reached: true,
      blocked: false,
    }),
    {
      householdId: HOUSEHOLD_ONE,
      creditsUsed: 97,
      creditsRemaining: 3,
      creditLimit: 100,
      warningReached: true,
      blocked: false,
    },
  );
});

Deno.test('rejects a client household selector and never reads status for it', async () => {
  const { handler, statusCalls } = setup({ householdIds: [HOUSEHOLD_ONE] });
  const response = await handler(request({ householdId: HOUSEHOLD_TWO }), 'request-1');

  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: 'invalid_request' });
  assertEquals(statusCalls, []);
});

Deno.test('rejects unauthenticated requests before resolving household scope', async () => {
  const { handler, memberCalls } = setup({ authenticated: false });
  const response = await handler(request(), 'request-2');

  assertEquals(response.status, 401);
  assertEquals(await response.json(), { error: 'unauthorized' });
  assertEquals(memberCalls, []);
});

Deno.test('derives all household statuses from the authenticated user membership', async () => {
  const { handler, authCalls, memberCalls, statusCalls } = setup({
    householdIds: [HOUSEHOLD_ONE, HOUSEHOLD_TWO, HOUSEHOLD_ONE],
  });
  const response = await handler(request(), 'request-3');

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    households: [
      {
        householdId: HOUSEHOLD_ONE,
        creditsUsed: 30,
        creditsRemaining: 70,
        creditLimit: 100,
        warningReached: false,
        blocked: false,
      },
      {
        householdId: HOUSEHOLD_TWO,
        creditsUsed: 30,
        creditsRemaining: 70,
        creditLimit: 100,
        warningReached: false,
        blocked: false,
      },
    ],
  });
  assertEquals(authCalls, [{ authorization: AUTHORIZATION, requestId: 'request-3' }]);
  assertEquals(memberCalls, [{
    userId: USER_ID,
    authorization: AUTHORIZATION,
    requestId: 'request-3',
  }]);
  assertEquals(statusCalls, [
    { householdId: HOUSEHOLD_ONE, requestId: 'request-3' },
    { householdId: HOUSEHOLD_TWO, requestId: 'request-3' },
  ]);
});

Deno.test('returns an empty status list for an authenticated user without households', async () => {
  const { handler } = setup({ householdIds: [] });
  const response = await handler(request(), 'request-4');

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { households: [] });
});

Deno.test('rejects a status row that does not carry the fixed limit', async () => {
  const { handler } = setup({
    householdIds: [HOUSEHOLD_ONE],
    rows: { credit_limit: 10 },
  });
  const response = await handler(request(), 'request-5');

  assertEquals(response.status, 500);
  assertEquals(await response.json(), { error: 'household_status_unavailable' });
});

Deno.test('hides membership and database details in safe error responses', async () => {
  const membershipFailure = await setup({ memberLookupFails: true }).handler(
    request(),
    'request-6',
  );
  assertEquals(membershipFailure.status, 500);
  assertEquals(await membershipFailure.json(), { error: 'household_lookup_failed' });

  const statusFailure = await setup({
    householdIds: [HOUSEHOLD_ONE],
    statusReadFails: true,
  }).handler(request(), 'request-7');
  assertEquals(statusFailure.status, 500);
  assertEquals(await statusFailure.json(), { error: 'household_status_unavailable' });
});
Deno.test('rejects invalid status values instead of exposing partial data', () => {
  assert(
    mapAiCreditStatus(HOUSEHOLD_ONE, {
      credits_used: -1,
      credits_remaining: 101,
      credit_limit: 100,
      warning_reached: false,
      blocked: false,
    }) === null,
  );
});
