import { assertEquals } from "jsr:@std/assert@1";

import {
  activeAiAssignmentHouseholdId,
  createRevenueCatWebhookHandler,
  type RevenueCatEntitlementChange,
  type SubscriberAttribute,
} from "./handler.ts";

const SECRET = "test-webhook-secret";
const USER_ID = "user-uuid-12345";
const HOUSEHOLD_ID = "5e1cf93a-bc56-4a29-848a-f6b0a628f127";
const NOW = new Date("2026-08-16T08:00:00.000Z");
const EXPIRATION = 1_776_326_400_000;
const EVENT_TIMESTAMP = 1_776_240_000_000;

type CapturedUpdate = {
  appUserId: string;
  change: RevenueCatEntitlementChange;
  subscriberAttributes?: Record<string, SubscriberAttribute> | null;
};

function request(event: Record<string, unknown>, authorization = SECRET) {
  return new Request("http://localhost/revenuecat-webhook", {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ api_version: "1.0", event }),
  });
}

function event(
  type: string,
  entitlementIds = ["Plus"],
  subscriberAttributes: Record<string, SubscriberAttribute> | null = null,
) {
  return {
    id: `event-${type}`,
    type,
    app_user_id: USER_ID,
    entitlement_ids: entitlementIds,
    expiration_at_ms: EXPIRATION,
    event_timestamp_ms: EVENT_TIMESTAMP,
    subscriber_attributes: subscriberAttributes,
  };
}

function setup(count = 1) {
  const updates: CapturedUpdate[] = [];
  const handler = createRevenueCatWebhookHandler({
    expectedSecret: SECRET,
    now: () => NOW,
    applyEntitlementEvent: (appUserId, change, subscriberAttributes) => {
      updates.push({ appUserId, change, subscriberAttributes });
      return Promise.resolve({ error: null, count });
    },
  });

  return { handler, updates };
}

Deno.test("reuses only an active canonical AI assignment", () => {
  assertEquals(
    activeAiAssignmentHouseholdId({
      household_id: HOUSEHOLD_ID,
      active: true,
    }),
    HOUSEHOLD_ID,
  );
  assertEquals(
    activeAiAssignmentHouseholdId({
      household_id: HOUSEHOLD_ID,
      active: false,
    }),
    null,
  );
  assertEquals(activeAiAssignmentHouseholdId(null), null);
});

Deno.test("rejects a missing or incorrect webhook secret", async () => {
  const { handler, updates } = setup();

  const missing = await handler(request(event("INITIAL_PURCHASE"), ""));
  const incorrect = await handler(request(event("INITIAL_PURCHASE"), "wrong"));

  assertEquals(missing.status, 401);
  assertEquals(incorrect.status, 401);
  assertEquals(updates, []);
});

for (const entitlementId of ["Plus", "AI"] as const) {
  for (
    const type of [
      "INITIAL_PURCHASE",
      "RENEWAL",
      "UNCANCELLATION",
      "PRODUCT_CHANGE",
    ]
  ) {
    Deno.test(`${type} activates household ${entitlementId} independently`, async () => {
      const { handler, updates } = setup();

      const response = await handler(
        request(
          event(type, [entitlementId], {
            household_id: { value: HOUSEHOLD_ID },
            $posthogUserId: { value: USER_ID },
          }),
        ),
      );

      assertEquals(response.status, 200);
      assertEquals(await response.json(), { updated: 1 });
      assertEquals(updates, [
        {
          appUserId: USER_ID,
          change: {
            entitlementId,
            active: true,
            expiresAt: new Date(EXPIRATION).toISOString(),
            eventId: `event-${type}`,
            eventTimestampMs: EVENT_TIMESTAMP,
            processedAt: NOW.toISOString(),
          },
          subscriberAttributes: {
            household_id: { value: HOUSEHOLD_ID },
            $posthogUserId: { value: USER_ID },
          },
        },
      ]);
    });
  }
}

for (const entitlementId of ["Plus", "AI"] as const) {
  Deno.test(`EXPIRATION revokes only household ${entitlementId}`, async () => {
    const { handler, updates } = setup();

    const response = await handler(
      request(event("EXPIRATION", [entitlementId])),
    );

    assertEquals(response.status, 200);
    assertEquals(updates[0]?.change.entitlementId, entitlementId);
    assertEquals(updates[0]?.change.active, false);
  });
}

Deno.test("applies Plus and AI independently when both are present", async () => {
  const { handler, updates } = setup();

  const response = await handler(request(event("RENEWAL", ["Plus", "AI"])));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { updated: 2 });
  assertEquals(
    updates.map(({ change }) => change.entitlementId),
    ["Plus", "AI"],
  );
});

for (const type of ["CANCELLATION", "BILLING_ISSUE"]) {
  Deno.test(`${type} keeps paid or grace-period access unchanged`, async () => {
    const { handler, updates } = setup();

    const response = await handler(request(event(type)));

    assertEquals(response.status, 200);
    assertEquals(await response.json(), { ignored: type });
    assertEquals(updates, []);
  });
}

Deno.test("ignores unrelated event types even without entitlement data", async () => {
  const { handler, updates } = setup();

  const response = await handler(
    request({
      id: "event-test",
      type: "TEST",
      app_user_id: USER_ID,
      entitlement_ids: null,
      event_timestamp_ms: EVENT_TIMESTAMP,
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { ignored: "TEST" });
  assertEquals(updates, []);
});

Deno.test("ignores purchase events without a known entitlement", async () => {
  const { handler, updates } = setup();

  const response = await handler(request(event("INITIAL_PURCHASE", ["Other"])));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { ignored: "unrelated_entitlement" });
  assertEquals(updates, []);
});

Deno.test("acknowledges an unknown household without triggering retries", async () => {
  const { handler } = setup(0);

  const response = await handler(request(event("INITIAL_PURCHASE")));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { updated: 0 });
});

Deno.test("rejects malformed events before touching the database", async () => {
  const { handler, updates } = setup();

  const response = await handler(
    request({
      id: "event-malformed",
      type: "INITIAL_PURCHASE",
      app_user_id: USER_ID,
      entitlement_ids: ["Plus"],
    }),
  );

  assertEquals(response.status, 400);
  assertEquals(updates, []);
});
