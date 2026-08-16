import { assertEquals } from 'jsr:@std/assert@1';

import {
  createRevenueCatWebhookHandler,
  type HouseholdPremiumUpdate,
} from './handler.ts';

const SECRET = 'test-webhook-secret';
const HOUSEHOLD_ID = '5e1cf93a-bc56-4a29-848a-f6b0a628f127';
const NOW = new Date('2026-08-16T08:00:00.000Z');
const EXPIRATION = 1_776_326_400_000;

type CapturedUpdate = {
  householdId: string;
  update: HouseholdPremiumUpdate;
};

function request(event: Record<string, unknown>, authorization = SECRET) {
  return new Request('http://localhost/revenuecat-webhook', {
    method: 'POST',
    headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_version: '1.0', event }),
  });
}

function event(type: string, entitlementIds = ['Premium']) {
  return {
    id: `event-${type}`,
    type,
    app_user_id: HOUSEHOLD_ID,
    entitlement_ids: entitlementIds,
    expiration_at_ms: EXPIRATION,
  };
}

function setup(count = 1) {
  const updates: CapturedUpdate[] = [];
  const handler = createRevenueCatWebhookHandler({
    expectedSecret: SECRET,
    now: () => NOW,
    updateHousehold: (householdId, update) => {
      updates.push({ householdId, update });
      return Promise.resolve({ error: null, count });
    },
  });

  return { handler, updates };
}

Deno.test('rejects a missing or incorrect webhook secret', async () => {
  const { handler, updates } = setup();

  const missing = await handler(request(event('INITIAL_PURCHASE'), ''));
  const incorrect = await handler(request(event('INITIAL_PURCHASE'), 'wrong'));

  assertEquals(missing.status, 401);
  assertEquals(incorrect.status, 401);
  assertEquals(updates, []);
});

for (const type of ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE']) {
  Deno.test(`${type} activates household premium`, async () => {
    const { handler, updates } = setup();

    const response = await handler(request(event(type)));

    assertEquals(response.status, 200);
    assertEquals(await response.json(), { updated: 1 });
    assertEquals(updates, [
      {
        householdId: HOUSEHOLD_ID,
        update: {
          premium_active: true,
          premium_expires_at: new Date(EXPIRATION).toISOString(),
          premium_updated_at: NOW.toISOString(),
        },
      },
    ]);
  });
}

Deno.test('EXPIRATION revokes household premium', async () => {
  const { handler, updates } = setup();

  const response = await handler(request(event('EXPIRATION')));

  assertEquals(response.status, 200);
  assertEquals(updates[0]?.update.premium_active, false);
});

for (const type of ['CANCELLATION', 'BILLING_ISSUE']) {
  Deno.test(`${type} keeps paid or grace-period access unchanged`, async () => {
    const { handler, updates } = setup();

    const response = await handler(request(event(type)));

    assertEquals(response.status, 200);
    assertEquals(await response.json(), { ignored: type });
    assertEquals(updates, []);
  });
}

Deno.test('ignores unrelated event types even without entitlement data', async () => {
  const { handler, updates } = setup();

  const response = await handler(
    request({
      id: 'event-test',
      type: 'TEST',
      app_user_id: HOUSEHOLD_ID,
      entitlement_ids: null,
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { ignored: 'TEST' });
  assertEquals(updates, []);
});

Deno.test('ignores purchase events without the Premium entitlement', async () => {
  const { handler, updates } = setup();

  const response = await handler(request(event('INITIAL_PURCHASE', ['Other'])));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { ignored: 'unrelated_entitlement' });
  assertEquals(updates, []);
});

Deno.test('acknowledges an unknown household without triggering retries', async () => {
  const { handler } = setup(0);

  const response = await handler(request(event('INITIAL_PURCHASE')));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { updated: 0 });
});

Deno.test('rejects malformed events before touching the database', async () => {
  const { handler, updates } = setup();

  const response = await handler(
    request({ type: 'INITIAL_PURCHASE', app_user_id: HOUSEHOLD_ID, entitlement_ids: ['Premium'] }),
  );

  assertEquals(response.status, 400);
  assertEquals(updates, []);
});
