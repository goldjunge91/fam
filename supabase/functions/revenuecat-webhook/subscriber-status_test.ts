import { assertEquals, assertRejects } from 'jsr:@std/assert@1';

import { createRevenueCatSubscriberStatusReader } from './subscriber-status.ts';

const SECRET_API_KEY = 'test_revenuecat_secret';
const REQUEST_DATE_MS = Date.parse('2026-08-16T08:00:00.000Z');
const FUTURE_EXPIRY = '2026-09-01T08:00:00.000Z';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function customerResponse(
  subscriber: Record<string, unknown>,
  requestDateMs = REQUEST_DATE_MS,
): Record<string, unknown> {
  return {
    request_date_ms: requestDateMs,
    subscriber,
  };
}

// **Validates: Requirements 3.5, 3.7**
Deno.test('Property 2: encodes subscriber IDs and authorizes only the injected fetcher', async () => {
  let fetchCount = 0;
  let observedRequest:
    | { url: string; authorization: string | null; accept: string | null }
    | undefined;
  const reader = createRevenueCatSubscriberStatusReader(
    SECRET_API_KEY,
    (input, init) => {
      fetchCount += 1;
      const headers = new Headers(init?.headers);
      observedRequest = {
        url: input instanceof Request ? input.url : input.toString(),
        authorization: headers.get('Authorization'),
        accept: headers.get('Accept'),
      };
      return Promise.resolve(
        jsonResponse(
          customerResponse({
            entitlements: {},
            subscriptions: {},
          }),
        ),
      );
    },
  );

  const result = await reader('$RCAnonymousID:customer/a?b=c');

  assertEquals(fetchCount, 1);
  assertEquals(observedRequest, {
    url: 'https://api.revenuecat.com/v1/subscribers/%24RCAnonymousID%3Acustomer%2Fa%3Fb%3Dc',
    authorization: `Bearer ${SECRET_API_KEY}`,
    accept: 'application/json',
  });
  assertEquals(result, {
    entitlements: {},
    subscriberAttributes: null,
  });
});

// **Validates: Requirements 3.5, 3.6**
Deno.test('Property 2: reads production subscriptions and non-subscriptions for Plus and AI', async () => {
  const reader = createRevenueCatSubscriberStatusReader(
    SECRET_API_KEY,
    () =>
      Promise.resolve(
        jsonResponse(
          customerResponse({
            entitlements: {
              Plus: {
                product_identifier: 'plus_monthly',
                expires_date: FUTURE_EXPIRY,
                grace_period_expires_date: null,
              },
              AI: {
                product_identifier: 'ai_lifetime',
                expires_date: null,
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              plus_monthly: { is_sandbox: false },
            },
            non_subscriptions: {
              ai_lifetime: [
                { is_sandbox: true },
                { is_sandbox: false },
              ],
            },
            subscriber_attributes: {
              household_id: { value: 'household-1', updated_at_ms: 1_776_240_000_000 },
              source: { value: 'revenuecat' },
              invalid_value: { value: 42 },
              invalid_timestamp: { value: 'ignored', updated_at_ms: 'yesterday' },
            },
          }),
        ),
      ),
  );

  assertEquals(await reader('subscriber-with-production-purchases'), {
    entitlements: {
      Plus: { active: true, expiresAt: FUTURE_EXPIRY },
      AI: { active: true, expiresAt: null },
    },
    subscriberAttributes: {
      household_id: { value: 'household-1', updated_at_ms: 1_776_240_000_000 },
      source: { value: 'revenuecat' },
    },
  });
});

// **Validates: Requirements 3.5, 3.6**
Deno.test('Property 2: evaluates expiry and grace period at RevenueCat request time', async () => {
  const graceExpiry = '2026-08-17T08:00:00.000Z';
  const reader = createRevenueCatSubscriberStatusReader(
    SECRET_API_KEY,
    () =>
      Promise.resolve(
        jsonResponse(
          customerResponse({
            entitlements: {
              Plus: {
                product_identifier: 'plus_monthly',
                expires_date: new Date(REQUEST_DATE_MS).toISOString(),
                grace_period_expires_date: null,
              },
              AI: {
                product_identifier: 'ai_monthly',
                expires_date: '2026-08-15T08:00:00.000Z',
                grace_period_expires_date: graceExpiry,
              },
            },
            subscriptions: {
              plus_monthly: { is_sandbox: false },
              ai_monthly: { is_sandbox: false },
            },
          }),
        ),
      ),
  );

  assertEquals(await reader('subscriber-with-expiry-boundaries'), {
    entitlements: {
      Plus: {
        active: false,
        expiresAt: new Date(REQUEST_DATE_MS).toISOString(),
      },
      AI: { active: true, expiresAt: graceExpiry },
    },
    subscriberAttributes: null,
  });
});

// **Validates: Requirements 3.5, 3.6**
Deno.test('Property 2: excludes sandbox-only purchases and accepts production purchases in mixed data', async () => {
  const responses = [
    customerResponse({
      entitlements: {
        Plus: {
          product_identifier: 'plus_sandbox',
          expires_date: FUTURE_EXPIRY,
          grace_period_expires_date: null,
        },
        AI: {
          product_identifier: 'ai_sandbox',
          expires_date: FUTURE_EXPIRY,
          grace_period_expires_date: null,
        },
      },
      subscriptions: {
        plus_sandbox: { is_sandbox: true },
      },
      non_subscriptions: {
        ai_sandbox: [{ is_sandbox: true }],
      },
    }),
    customerResponse({
      entitlements: {
        Plus: {
          product_identifier: 'plus_production',
          expires_date: FUTURE_EXPIRY,
          grace_period_expires_date: null,
        },
        AI: {
          product_identifier: 'ai_mixed',
          expires_date: FUTURE_EXPIRY,
          grace_period_expires_date: null,
        },
      },
      subscriptions: {
        plus_production: { is_sandbox: false },
        unrelated_sandbox: { is_sandbox: true },
      },
      non_subscriptions: {
        ai_mixed: [{ is_sandbox: true }, { is_sandbox: false }],
      },
    }),
  ];
  let responseIndex = 0;
  const reader = createRevenueCatSubscriberStatusReader(
    SECRET_API_KEY,
    () => Promise.resolve(jsonResponse(responses[responseIndex++])),
  );

  assertEquals(await reader('sandbox-only'), {
    entitlements: {
      Plus: { active: false, expiresAt: null },
      AI: { active: false, expiresAt: null },
    },
    subscriberAttributes: null,
  });
  assertEquals(await reader('mixed-environments'), {
    entitlements: {
      Plus: { active: true, expiresAt: FUTURE_EXPIRY },
      AI: { active: true, expiresAt: FUTURE_EXPIRY },
    },
    subscriberAttributes: null,
  });
  assertEquals(responseIndex, 2);
});

// **Validates: Requirements 3.7**
Deno.test('Property 2: reports missing configuration and upstream response failures', async () => {
  let unconfiguredFetchCount = 0;
  const unconfiguredReader = createRevenueCatSubscriberStatusReader(
    undefined,
    () => {
      unconfiguredFetchCount += 1;
      return Promise.resolve(jsonResponse({}));
    },
  );

  await assertRejects(
    () => unconfiguredReader('subscriber'),
    Error,
    'RevenueCat secret API key is not configured.',
  );
  assertEquals(unconfiguredFetchCount, 0);

  const rejectedReader = createRevenueCatSubscriberStatusReader(
    SECRET_API_KEY,
    () => Promise.resolve(jsonResponse({ error: 'unavailable' }, 503)),
  );
  await assertRejects(
    () => rejectedReader('subscriber'),
    Error,
    'RevenueCat customer lookup failed (503).',
  );

  const invalidJsonReader = createRevenueCatSubscriberStatusReader(
    SECRET_API_KEY,
    () => Promise.resolve(new Response('not-json', { status: 200 })),
  );
  await assertRejects(() => invalidJsonReader('subscriber'), Error);
});

const INVALID_CUSTOMER_RESPONSES = [
  {
    label: 'a missing subscriber',
    body: { request_date_ms: REQUEST_DATE_MS },
  },
  {
    label: 'missing entitlements',
    body: customerResponse({ subscriptions: {} }),
  },
  {
    label: 'missing subscriptions',
    body: customerResponse({ entitlements: {} }),
  },
  {
    label: 'invalid non-subscriptions',
    body: customerResponse({
      entitlements: {},
      subscriptions: {},
      non_subscriptions: [],
    }),
  },
  {
    label: 'an invalid entitlement date',
    body: customerResponse({
      entitlements: {
        Plus: {
          product_identifier: 'plus_monthly',
          expires_date: 'not-a-date',
          grace_period_expires_date: null,
        },
      },
      subscriptions: {
        plus_monthly: { is_sandbox: false },
      },
    }),
  },
] as const;

for (const invalidResponse of INVALID_CUSTOMER_RESPONSES) {
  // **Validates: Requirements 3.7**
  Deno.test(`Property 2: rejects ${invalidResponse.label} in the customer response`, async () => {
    const reader = createRevenueCatSubscriberStatusReader(
      SECRET_API_KEY,
      () => Promise.resolve(jsonResponse(invalidResponse.body)),
    );

    await assertRejects(() => reader('subscriber'), Error);
  });
}
