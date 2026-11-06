import { assertEquals } from 'jsr:@std/assert@1';

import {
  activeAiAssignmentHouseholdId,
  createRevenueCatWebhookHandler,
  type RevenueCatEntitlementChange,
  type RevenueCatSubscriberStatus,
  type SubscriberAttribute,
} from './handler.ts';

const SECRET = 'test-webhook-secret';
const USER_ID = 'user-uuid-12345';
const HOUSEHOLD_ID = '5e1cf93a-bc56-4a29-848a-f6b0a628f127';
const NOW = new Date('2026-08-16T08:00:00.000Z');
const EXPIRATION = 1_776_326_400_000;
const EVENT_TIMESTAMP = 1_776_240_000_000;

type CapturedUpdate = {
  appUserId: string;
  change: RevenueCatEntitlementChange;
  subscriberAttributes?: Record<string, SubscriberAttribute> | null;
};

async function request(
  event: Record<string, unknown>,
  signingSecret = SECRET,
  timestampSeconds = NOW.getTime() / 1000,
) {
  const body = JSON.stringify({ api_version: '1.0', event });
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(`${timestampSeconds}.${body}`),
    ),
  );
  const signatureHex = Array.from(
    signature,
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');

  return new Request('http://localhost/revenuecat-webhook', {
    method: 'POST',
    headers: {
      'X-RevenueCat-Webhook-Signature': `t=${timestampSeconds},v1=${signatureHex}`,
      'Content-Type': 'application/json',
    },
    body,
  });
}

function event(
  type: string,
  entitlementIds = ['Plus'],
  subscriberAttributes: Record<string, SubscriberAttribute> | null = null,
  environment: string | null = 'PRODUCTION',
) {
  return {
    id: `event-${type}`,
    type,
    app_user_id: USER_ID,
    entitlement_ids: entitlementIds,
    expiration_at_ms: EXPIRATION,
    event_timestamp_ms: EVENT_TIMESTAMP,
    subscriber_attributes: subscriberAttributes,
    ...(environment === null ? {} : { environment }),
  };
}

function setup(count = 1, status?: RevenueCatSubscriberStatus | Error) {
  const updates: CapturedUpdate[] = [];
  const handler = createRevenueCatWebhookHandler({
    expectedSecret: SECRET,
    now: () => NOW,
    applyEntitlementEvent: (appUserId, change, subscriberAttributes) => {
      updates.push({ appUserId, change, subscriberAttributes });
      return Promise.resolve({ error: null, count });
    },
    ...(status === undefined ? {} : {
      readSubscriberStatus: () =>
        status instanceof Error ? Promise.reject(status) : Promise.resolve(status),
    }),
  });

  return { handler, updates };
}

Deno.test('reuses only the current active AI assignment', () => {
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

Deno.test('rejects a missing or incorrect HMAC signature', async () => {
  const { handler, updates } = setup();

  const missing = await handler(
    new Request('http://localhost/revenuecat-webhook', {
      method: 'POST',
      body: JSON.stringify({
        api_version: '1.0',
        event: event('INITIAL_PURCHASE'),
      }),
    }),
  );
  const incorrect = await handler(
    await request(event('INITIAL_PURCHASE'), 'wrong'),
  );

  assertEquals(missing.status, 401);
  assertEquals(incorrect.status, 401);
  assertEquals(updates, []);
});

Deno.test('rejects an expired HMAC signature', async () => {
  const { handler, updates } = setup();
  const response = await handler(
    await request(
      event('INITIAL_PURCHASE'),
      SECRET,
      NOW.getTime() / 1000 - 301,
    ),
  );

  assertEquals(response.status, 401);
  assertEquals(updates, []);
});

for (
  const { label, value } of [
    { label: 'SANDBOX', value: 'SANDBOX' },
    { label: 'missing environment', value: null },
    { label: 'unknown environment', value: 'STAGING' },
  ]
) {
  for (const type of ['INITIAL_PURCHASE', 'EXPIRATION']) {
    Deno.test(`ignores ${type} with ${label} on the production webhook`, async () => {
      const { handler, updates } = setup();
      const response = await handler(
        await request(event(type, ['Plus'], null, value)),
      );

      assertEquals(response.status, 200);
      assertEquals(await response.json(), { ignored: 'non_production' });
      assertEquals(updates, []);
    });
  }
}

for (const entitlementId of ['Plus', 'AI'] as const) {
  for (
    const type of [
      'INITIAL_PURCHASE',
      'RENEWAL',
      'UNCANCELLATION',
      'PRODUCT_CHANGE',
    ]
  ) {
    Deno.test(`${type} activates household ${entitlementId} independently`, async () => {
      const { handler, updates } = setup();

      const response = await handler(
        await request(
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

for (const entitlementId of ['Plus', 'AI'] as const) {
  Deno.test(`EXPIRATION revokes only household ${entitlementId}`, async () => {
    const { handler, updates } = setup();

    const response = await handler(
      await request(event('EXPIRATION', [entitlementId])),
    );

    assertEquals(response.status, 200);
    assertEquals(updates[0]?.change.entitlementId, entitlementId);
    assertEquals(updates[0]?.change.active, false);
  });
}

Deno.test('applies Plus and AI independently when both are present', async () => {
  const { handler, updates } = setup();

  const response = await handler(
    await request(event('RENEWAL', ['Plus', 'AI'])),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { updated: 2 });
  assertEquals(
    updates.map(({ change }) => change.entitlementId),
    ['Plus', 'AI'],
  );
});

for (const type of ['CANCELLATION']) {
  Deno.test(`${type} keeps paid or grace-period access unchanged`, async () => {
    const { handler, updates } = setup();

    const response = await handler(await request(event(type)));

    assertEquals(response.status, 200);
    assertEquals(await response.json(), { ignored: type });
    assertEquals(updates, []);
  });
}

Deno.test('BILLING_ISSUE refreshes the official grace-period expiry from RevenueCat', async () => {
  const graceExpiry = '2026-08-23T08:00:00.000Z';
  const requestDateMs = NOW.getTime() + 60_000;
  const { handler, updates } = setup(1, {
    entitlements: { Plus: { active: true, expiresAt: graceExpiry } },
    requestDateMs,
  });

  const response = await handler(await request(event('BILLING_ISSUE')));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { updated: 1 });
  assertEquals(updates[0]?.change, {
    entitlementId: 'Plus',
    active: true,
    expiresAt: graceExpiry,
    eventId: 'event-BILLING_ISSUE',
    eventTimestampMs: requestDateMs,
    processedAt: NOW.toISOString(),
  });
});

Deno.test('BILLING_ISSUE fails closed when fresh RevenueCat status is unavailable', async () => {
  const { handler, updates } = setup(1, new Error('RevenueCat unavailable'));
  const response = await handler(await request(event('BILLING_ISSUE')));

  assertEquals(response.status, 503);
  assertEquals(await response.json(), { error: 'status_refresh_failed' });
  assertEquals(updates, []);
});

Deno.test('ignores unrelated event types even without entitlement data', async () => {
  const { handler, updates } = setup();

  const response = await handler(
    await request({
      id: 'event-test',
      type: 'TEST',
      app_user_id: USER_ID,
      entitlement_ids: null,
      event_timestamp_ms: EVENT_TIMESTAMP,
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { ignored: 'TEST' });
  assertEquals(updates, []);
});

Deno.test('ignores purchase events without a known entitlement', async () => {
  const { handler, updates } = setup();

  const response = await handler(
    await request(event('INITIAL_PURCHASE', ['Other'])),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { ignored: 'unrelated_entitlement' });
  assertEquals(updates, []);
});

Deno.test('acknowledges an unknown household without triggering retries', async () => {
  const { handler } = setup(0);

  const response = await handler(await request(event('INITIAL_PURCHASE')));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { updated: 0 });
});

Deno.test('rejects malformed events before touching the database', async () => {
  const { handler, updates } = setup();

  const response = await handler(
    await request({
      id: 'event-malformed',
      type: 'INITIAL_PURCHASE',
      app_user_id: USER_ID,
      entitlement_ids: ['Plus'],
    }),
  );

  assertEquals(response.status, 400);
  assertEquals(updates, []);
});

const TRANSFER_OLD_LOCAL_ID = '11111111-1111-1111-1111-111111111111';
const TRANSFER_NEW_LOCAL_ID = '22222222-2222-2222-2222-222222222222';
const TRANSFER_NON_LOCAL_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TRANSFER_ANONYMOUS_ID = '$RCAnonymousID:exploration';
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TransferSide = 'transferred_from' | 'transferred_to';
type TransferPosition = 'before' | 'after';

type TransferExplorationCase = {
  label: string;
  transferredFrom: string[];
  transferredTo: string[];
  environment?: 'PRODUCTION';
};

type TransferExplorationRun = {
  responseStatus: number;
  responseBody: unknown;
  statusReads: string[];
  profileLookupCandidates: string[][];
  profileLookupResults: Array<Array<[string, string]>>;
  projections: CapturedUpdate[];
  trace: string[];
};

type TransferCounterexample = {
  scenario: string;
  failures: string[];
  originalTrace: string[];
  permutedTrace: string[];
};

function sorted(values: Iterable<string>): string[] {
  return Array.from(values).sort((left, right) => left.localeCompare(right));
}

function occurrences(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return sorted(
    Array.from(counts, ([value, count]) => `${value}:${count}`),
  );
}

function normalizedProjections(updates: CapturedUpdate[]): string[] {
  return sorted(
    new Set(
      updates.map(({ appUserId, change }) =>
        [
          appUserId,
          change.entitlementId,
          change.active ? 'active' : 'inactive',
          change.expiresAt ?? 'null',
        ].join('|')
      ),
    ),
  );
}

function sameValues(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function readsFinishBeforeProjection(trace: string[]): boolean {
  const firstProjection = trace.findIndex((entry) => entry.startsWith('projection:'));
  const statusCompletions = trace
    .map((entry, index) => entry.startsWith('status:complete:') ? index : -1)
    .filter((index) => index >= 0);
  const profileCompletion = trace.findIndex((entry) => entry.startsWith('profiles:complete:'));

  return firstProjection >= 0 &&
    statusCompletions.length > 0 &&
    profileCompletion >= 0 &&
    statusCompletions.every((index) => index < firstProjection) &&
    profileCompletion < firstProjection;
}

async function runTransferExploration(
  explorationCase: TransferExplorationCase,
): Promise<TransferExplorationRun> {
  const confirmedProfileIds = new Set([
    TRANSFER_OLD_LOCAL_ID,
    TRANSFER_NEW_LOCAL_ID,
  ]);
  const statusReads: string[] = [];
  const profileLookupCandidates: string[][] = [];
  const profileLookupResults: Array<Array<[string, string]>> = [];
  const projections: CapturedUpdate[] = [];
  const trace: string[] = [];

  const readSubscriberStatus = async (subscriberId: string) => {
    statusReads.push(subscriberId);
    trace.push(`status:start:${subscriberId}`);
    await Promise.resolve();
    trace.push(`status:complete:${subscriberId}`);

    const active = subscriberId === TRANSFER_NEW_LOCAL_ID;
    const expiresAt = active ? new Date(EXPIRATION).toISOString() : null;
    return {
      entitlements: {
        Plus: { active, expiresAt },
        AI: { active, expiresAt },
      },
      subscriberAttributes: {
        source_subscriber: { value: subscriberId },
      },
    };
  };

  const resolveLocalProfiles = async (subscriberIds: string[]) => {
    const candidates = [...subscriberIds];
    profileLookupCandidates.push(candidates);
    trace.push(`profiles:start:${candidates.join(',')}`);
    await Promise.resolve();

    const matches = candidates.flatMap((subscriberId) =>
      confirmedProfileIds.has(subscriberId)
        ? [[subscriberId, subscriberId] as [string, string]]
        : []
    );
    profileLookupResults.push(matches);
    trace.push(
      `profiles:complete:${
        matches.map(([subscriberId, profileId]) => `${subscriberId}->${profileId}`).join(',')
      }`,
    );
    return new Map(matches);
  };

  const dependencies = {
    expectedSecret: SECRET,
    now: () => NOW,
    readSubscriberStatus,
    resolveLocalProfiles,
    applyEntitlementEvent: (
      appUserId: string,
      change: RevenueCatEntitlementChange,
      subscriberAttributes?: Record<string, SubscriberAttribute> | null,
    ) => {
      projections.push({ appUserId, change, subscriberAttributes });
      trace.push(`projection:${appUserId}:${change.entitlementId}`);

      if (!confirmedProfileIds.has(appUserId)) {
        return Promise.resolve({
          error: { message: `non_local_projection:${appUserId}` },
          count: null,
        });
      }
      return Promise.resolve({ error: null, count: 1 });
    },
  };
  const handler = createRevenueCatWebhookHandler(dependencies);
  const response = await handler(
    await request({
      id: `event-${explorationCase.label}`,
      type: 'TRANSFER',
      event_timestamp_ms: EVENT_TIMESTAMP,
      transferred_from: explorationCase.transferredFrom,
      transferred_to: explorationCase.transferredTo,
      ...(explorationCase.environment ? { environment: explorationCase.environment } : {}),
    }),
  );

  return {
    responseStatus: response.status,
    responseBody: await response.json(),
    statusReads,
    profileLookupCandidates,
    profileLookupResults,
    projections,
    trace,
  };
}

function expectedProjectionSet(): string[] {
  const activeExpiration = new Date(EXPIRATION).toISOString();
  return sorted([
    `${TRANSFER_OLD_LOCAL_ID}|Plus|inactive|null`,
    `${TRANSFER_OLD_LOCAL_ID}|AI|inactive|null`,
    `${TRANSFER_NEW_LOCAL_ID}|Plus|active|${activeExpiration}`,
    `${TRANSFER_NEW_LOCAL_ID}|AI|active|${activeExpiration}`,
  ]);
}

function inspectExpectedTransferBehavior(
  run: TransferExplorationRun,
  explorationCase: TransferExplorationCase,
): string[] {
  const failures: string[] = [];
  const subscriberIds = Array.from(
    new Set([
      ...explorationCase.transferredFrom,
      ...explorationCase.transferredTo,
    ]),
  );
  const expectedReads = sorted(subscriberIds.map((subscriberId) => `${subscriberId}:1`));
  const actualReads = occurrences(run.statusReads);
  const expectedCandidates = sorted(
    subscriberIds.filter((subscriberId) => UUID_SHAPE.test(subscriberId)),
  );
  const actualCandidates = run.profileLookupCandidates.map((candidates) => sorted(candidates));
  const expectedProfileIds = sorted([
    TRANSFER_OLD_LOCAL_ID,
    TRANSFER_NEW_LOCAL_ID,
  ]);
  const projectedProfileIds = sorted(
    new Set(run.projections.map(({ appUserId }) => appUserId)),
  );
  const expectedChanges = expectedProjectionSet();
  const actualChanges = normalizedProjections(run.projections);

  if (run.responseStatus !== 200) {
    failures.push(
      `HTTP expected 200, received ${run.responseStatus} ${JSON.stringify(run.responseBody)}`,
    );
  }
  if (!sameValues(run.responseBody, { updated: 4 })) {
    failures.push(
      `body expected {"updated":4}, received ${JSON.stringify(run.responseBody)}`,
    );
  }
  if (!sameValues(actualReads, expectedReads)) {
    failures.push(
      `status reads expected ${JSON.stringify(expectedReads)}, received ${
        JSON.stringify(actualReads)
      }`,
    );
  }
  if (!sameValues(actualCandidates, [expectedCandidates])) {
    failures.push(
      `profile candidates expected ${JSON.stringify([expectedCandidates])}, received ${
        JSON.stringify(actualCandidates)
      }`,
    );
  }
  if (!sameValues(projectedProfileIds, expectedProfileIds)) {
    failures.push(
      `projected profile IDs expected ${JSON.stringify(expectedProfileIds)}, received ${
        JSON.stringify(projectedProfileIds)
      }`,
    );
  }
  if (!sameValues(actualChanges, expectedChanges)) {
    failures.push(
      `changes expected ${JSON.stringify(expectedChanges)}, received ${
        JSON.stringify(actualChanges)
      }`,
    );
  }
  if (!readsFinishBeforeProjection(run.trace)) {
    failures.push('all status and profile reads must finish before the first projection');
  }

  return failures;
}

function withNonLocalId(
  nonLocalId: string,
  side: TransferSide,
  position: TransferPosition,
): Pick<TransferExplorationCase, 'transferredFrom' | 'transferredTo'> {
  const localId = side === 'transferred_from' ? TRANSFER_OLD_LOCAL_ID : TRANSFER_NEW_LOCAL_ID;
  const selectedSide = position === 'before'
    ? [nonLocalId, nonLocalId, localId]
    : [localId, nonLocalId, nonLocalId];

  return {
    transferredFrom: side === 'transferred_from' ? selectedSide : [TRANSFER_OLD_LOCAL_ID],
    transferredTo: side === 'transferred_to' ? selectedSide : [TRANSFER_NEW_LOCAL_ID],
  };
}

function permuteTransferCase(
  explorationCase: TransferExplorationCase,
): TransferExplorationCase {
  return {
    ...explorationCase,
    label: `${explorationCase.label}-permuted`,
    transferredFrom: [...explorationCase.transferredFrom].reverse(),
    transferredTo: [...explorationCase.transferredTo].reverse(),
  };
}

// **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3**
Deno.test('Property 1: external transfer IDs do not block confirmed local users', async () => {
  const generatedCases: TransferExplorationCase[] = [];
  const nonLocalIds = [
    { label: 'anonymous', value: TRANSFER_ANONYMOUS_ID },
    { label: 'uuid-without-profile', value: TRANSFER_NON_LOCAL_UUID },
  ] as const;
  const sides = ['transferred_from', 'transferred_to'] as const;
  const positions = ['before', 'after'] as const;

  for (const nonLocalId of nonLocalIds) {
    for (const side of sides) {
      for (const position of positions) {
        generatedCases.push({
          label: `${nonLocalId.label}-${side}-${position}`,
          ...withNonLocalId(nonLocalId.value, side, position),
          environment: 'PRODUCTION',
        });
      }
    }
  }

  generatedCases.push({
    label: 'mixed-both-sides-missing-environment',
    transferredFrom: [TRANSFER_ANONYMOUS_ID, TRANSFER_OLD_LOCAL_ID],
    transferredTo: [TRANSFER_NEW_LOCAL_ID, TRANSFER_NON_LOCAL_UUID],
  });

  const counterexamples: TransferCounterexample[] = [];
  for (const explorationCase of generatedCases) {
    const permutedCase = permuteTransferCase(explorationCase);
    const original = await runTransferExploration(explorationCase);
    const permuted = await runTransferExploration(permutedCase);
    const failures = [
      ...inspectExpectedTransferBehavior(original, explorationCase).map((failure) =>
        `original: ${failure}`
      ),
      ...inspectExpectedTransferBehavior(permuted, permutedCase).map((failure) =>
        `permuted: ${failure}`
      ),
    ];

    const originalChanges = normalizedProjections(original.projections);
    const permutedChanges = normalizedProjections(permuted.projections);
    if (!sameValues(originalChanges, permutedChanges)) {
      failures.push(
        `order changed projected set from ${JSON.stringify(originalChanges)} to ${
          JSON.stringify(permutedChanges)
        }`,
      );
    }
    if (original.responseStatus !== permuted.responseStatus) {
      failures.push(
        `order changed HTTP status from ${original.responseStatus} to ${permuted.responseStatus}`,
      );
    }

    if (failures.length > 0) {
      counterexamples.push({
        scenario: explorationCase.label,
        failures,
        originalTrace: original.trace,
        permutedTrace: permuted.trace,
      });
    }
  }

  assertEquals(counterexamples, []);
});

function preservationTransferEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-transfer-preservation',
    type: 'TRANSFER',
    environment: 'PRODUCTION',
    event_timestamp_ms: EVENT_TIMESTAMP,
    transferred_from: [TRANSFER_OLD_LOCAL_ID],
    transferred_to: [TRANSFER_NEW_LOCAL_ID],
    ...overrides,
  };
}

function inactiveSubscriberStatus() {
  return {
    entitlements: {
      Plus: { active: false, expiresAt: null },
      AI: { active: false, expiresAt: null },
    },
    subscriberAttributes: null,
  };
}

// **Validates: Requirements 3.1**
Deno.test('Property 2: transfer authentication fails before reads or mutations', async () => {
  let statusReadCount = 0;
  let profileLookupCount = 0;
  const updates: CapturedUpdate[] = [];
  const dependencies = {
    expectedSecret: SECRET,
    now: () => NOW,
    readSubscriberStatus: () => {
      statusReadCount += 1;
      return Promise.resolve(inactiveSubscriberStatus());
    },
    resolveLocalProfiles: (subscriberIds: string[]) => {
      profileLookupCount += 1;
      return Promise.resolve(new Map(subscriberIds.map((id) => [id, id])));
    },
    applyEntitlementEvent: (
      appUserId: string,
      change: RevenueCatEntitlementChange,
      subscriberAttributes?: Record<string, SubscriberAttribute> | null,
    ) => {
      updates.push({ appUserId, change, subscriberAttributes });
      return Promise.resolve({ error: null, count: 1 });
    },
  };
  const handler = createRevenueCatWebhookHandler(dependencies);
  const transfer = preservationTransferEvent();
  const unsignedBody = JSON.stringify({ api_version: '1.0', event: transfer });
  const unauthorizedRequests = [
    new Request('http://localhost/revenuecat-webhook', {
      method: 'POST',
      body: unsignedBody,
    }),
    await request(transfer, 'wrong-secret'),
    await request(transfer, SECRET, NOW.getTime() / 1000 - 301),
  ];

  for (const unauthorizedRequest of unauthorizedRequests) {
    const response = await handler(unauthorizedRequest);
    assertEquals(response.status, 401);
    assertEquals(await response.json(), { error: 'unauthorized' });
  }

  assertEquals(statusReadCount, 0);
  assertEquals(profileLookupCount, 0);
  assertEquals(updates, []);
});

// **Validates: Requirements 3.2**
Deno.test('Property 2: invalid transfer fields fail before reads or mutations', async () => {
  let statusReadCount = 0;
  let profileLookupCount = 0;
  const updates: CapturedUpdate[] = [];
  const dependencies = {
    expectedSecret: SECRET,
    now: () => NOW,
    readSubscriberStatus: () => {
      statusReadCount += 1;
      return Promise.resolve(inactiveSubscriberStatus());
    },
    resolveLocalProfiles: (subscriberIds: string[]) => {
      profileLookupCount += 1;
      return Promise.resolve(new Map(subscriberIds.map((id) => [id, id])));
    },
    applyEntitlementEvent: (
      appUserId: string,
      change: RevenueCatEntitlementChange,
      subscriberAttributes?: Record<string, SubscriberAttribute> | null,
    ) => {
      updates.push({ appUserId, change, subscriberAttributes });
      return Promise.resolve({ error: null, count: 1 });
    },
  };
  const handler = createRevenueCatWebhookHandler(dependencies);
  const invalidTransfers = [
    preservationTransferEvent({ transferred_from: [] }),
    preservationTransferEvent({ transferred_to: [42] }),
    preservationTransferEvent({ event_timestamp_ms: Number.POSITIVE_INFINITY }),
  ];

  for (const invalidTransfer of invalidTransfers) {
    const response = await handler(await request(invalidTransfer));
    assertEquals(response.status, 400);
    assertEquals((await response.json()).error, 'invalid_payload');
  }

  assertEquals(statusReadCount, 0);
  assertEquals(profileLookupCount, 0);
  assertEquals(updates, []);
});

// **Validates: Requirements 3.4**
Deno.test('Property 2: explicit non-production transfers bypass all dependencies', async () => {
  let statusReadCount = 0;
  let profileLookupCount = 0;
  const updates: CapturedUpdate[] = [];
  const dependencies = {
    expectedSecret: SECRET,
    now: () => NOW,
    readSubscriberStatus: () => {
      statusReadCount += 1;
      return Promise.resolve(inactiveSubscriberStatus());
    },
    resolveLocalProfiles: (subscriberIds: string[]) => {
      profileLookupCount += 1;
      return Promise.resolve(new Map(subscriberIds.map((id) => [id, id])));
    },
    applyEntitlementEvent: (
      appUserId: string,
      change: RevenueCatEntitlementChange,
      subscriberAttributes?: Record<string, SubscriberAttribute> | null,
    ) => {
      updates.push({ appUserId, change, subscriberAttributes });
      return Promise.resolve({ error: null, count: 1 });
    },
  };
  const handler = createRevenueCatWebhookHandler(dependencies);

  for (const environment of ['SANDBOX', 'STAGING']) {
    const response = await handler(
      await request(preservationTransferEvent({ environment })),
    );
    assertEquals(response.status, 200);
    assertEquals(await response.json(), { ignored: 'non_production' });
  }

  assertEquals(statusReadCount, 0);
  assertEquals(profileLookupCount, 0);
  assertEquals(updates, []);
});

for (const environment of ['PRODUCTION', undefined] as const) {
  const label = environment ?? 'missing environment';

  // **Validates: Requirements 3.3, 3.5, 3.8**
  Deno.test(`Property 2: ${label} transfer deduplicates reads and preserves status projections`, async () => {
    const statusReads: string[] = [];
    const profileLookupCandidates: string[][] = [];
    const updates: CapturedUpdate[] = [];
    const trace: string[] = [];
    const activeExpiration = new Date(EXPIRATION).toISOString();
    const dependencies = {
      expectedSecret: SECRET,
      now: () => NOW,
      readSubscriberStatus: async (subscriberId: string) => {
        statusReads.push(subscriberId);
        trace.push(`status:start:${subscriberId}`);
        await Promise.resolve();
        trace.push(`status:complete:${subscriberId}`);
        const active = subscriberId === TRANSFER_NEW_LOCAL_ID;
        return {
          entitlements: active
            ? {
              Plus: { active: true, expiresAt: activeExpiration },
              AI: { active: true, expiresAt: activeExpiration },
            }
            : {
              Plus: { active: false, expiresAt: null },
            },
          subscriberAttributes: {
            source_subscriber: { value: subscriberId },
          },
        };
      },
      resolveLocalProfiles: async (subscriberIds: string[]) => {
        profileLookupCandidates.push([...subscriberIds]);
        trace.push('profiles:start');
        await Promise.resolve();
        trace.push('profiles:complete');
        return new Map(subscriberIds.map((id) => [id, id]));
      },
      applyEntitlementEvent: (
        appUserId: string,
        change: RevenueCatEntitlementChange,
        subscriberAttributes?: Record<string, SubscriberAttribute> | null,
      ) => {
        trace.push(`projection:${appUserId}:${change.entitlementId}`);
        updates.push({ appUserId, change, subscriberAttributes });
        return Promise.resolve({ error: null, count: 1 });
      },
    };
    const handler = createRevenueCatWebhookHandler(dependencies);
    const transfer = preservationTransferEvent({
      app_user_id: undefined,
      environment,
      transferred_from: [TRANSFER_OLD_LOCAL_ID, TRANSFER_OLD_LOCAL_ID],
      transferred_to: [
        TRANSFER_NEW_LOCAL_ID,
        TRANSFER_OLD_LOCAL_ID,
        TRANSFER_NEW_LOCAL_ID,
      ],
    });

    const response = await handler(await request(transfer));

    assertEquals(response.status, 200);
    assertEquals(await response.json(), { updated: 4 });
    assertEquals(occurrences(statusReads), [
      `${TRANSFER_OLD_LOCAL_ID}:1`,
      `${TRANSFER_NEW_LOCAL_ID}:1`,
    ]);
    assertEquals(normalizedProjections(updates), expectedProjectionSet());
    assertEquals(
      updates.map(({ appUserId, change }) => `${appUserId}|${change.eventId}`),
      [
        `${TRANSFER_OLD_LOCAL_ID}|transfer:event-transfer-preservation:${TRANSFER_OLD_LOCAL_ID}`,
        `${TRANSFER_OLD_LOCAL_ID}|transfer:event-transfer-preservation:${TRANSFER_OLD_LOCAL_ID}`,
        `${TRANSFER_NEW_LOCAL_ID}|transfer:event-transfer-preservation:${TRANSFER_NEW_LOCAL_ID}`,
        `${TRANSFER_NEW_LOCAL_ID}|transfer:event-transfer-preservation:${TRANSFER_NEW_LOCAL_ID}`,
      ],
    );
    const firstProjection = trace.findIndex((entry) => entry.startsWith('projection:'));
    const statusCompletions = trace
      .map((entry, index) => entry.startsWith('status:complete:') ? index : -1)
      .filter((index) => index >= 0);
    assertEquals(
      firstProjection >= 0 && statusCompletions.every((index) => index < firstProjection),
      true,
    );

    // F has no profile reader yet. Once F' introduces it, this injected reader
    // lets the unchanged preservation case continue to use only local UUIDs.
    assertEquals(profileLookupCandidates.length <= 1, true);
  });
}

// **Validates: Requirements 3.7**
Deno.test('Property 2: unavailable or failing status readers stop before local work', async () => {
  let profileLookupCount = 0;
  const updates: CapturedUpdate[] = [];
  const baseDependencies = {
    expectedSecret: SECRET,
    now: () => NOW,
    resolveLocalProfiles: (subscriberIds: string[]) => {
      profileLookupCount += 1;
      return Promise.resolve(new Map(subscriberIds.map((id) => [id, id])));
    },
    applyEntitlementEvent: (
      appUserId: string,
      change: RevenueCatEntitlementChange,
      subscriberAttributes?: Record<string, SubscriberAttribute> | null,
    ) => {
      updates.push({ appUserId, change, subscriberAttributes });
      return Promise.resolve({ error: null, count: 1 });
    },
  };
  const unavailableHandler = createRevenueCatWebhookHandler(baseDependencies);
  const unavailableResponse = await unavailableHandler(
    await request(preservationTransferEvent()),
  );

  assertEquals(unavailableResponse.status, 503);
  assertEquals(await unavailableResponse.json(), {
    error: 'subscriber_status_unavailable',
  });
  assertEquals(profileLookupCount, 0);
  assertEquals(updates, []);

  const statusReads: string[] = [];
  const failingDependencies = {
    ...baseDependencies,
    readSubscriberStatus: (subscriberId: string) => {
      statusReads.push(subscriberId);
      if (subscriberId === TRANSFER_NEW_LOCAL_ID) {
        return Promise.reject(new Error('upstream unavailable'));
      }
      return Promise.resolve(inactiveSubscriberStatus());
    },
  };
  const failingHandler = createRevenueCatWebhookHandler(failingDependencies);
  const failingResponse = await failingHandler(
    await request(preservationTransferEvent()),
  );

  assertEquals(failingResponse.status, 502);
  assertEquals(await failingResponse.json(), {
    error: 'subscriber_status_lookup_failed',
  });
  assertEquals(occurrences(statusReads), [
    `${TRANSFER_OLD_LOCAL_ID}:1`,
    `${TRANSFER_NEW_LOCAL_ID}:1`,
  ]);
  assertEquals(profileLookupCount, 0);
  assertEquals(updates, []);
});

// **Validates: Requirements 3.9**
Deno.test('Property 2: regular events never use transfer readers', async () => {
  let statusReadCount = 0;
  let profileLookupCount = 0;
  const updates: CapturedUpdate[] = [];
  const dependencies = {
    expectedSecret: SECRET,
    now: () => NOW,
    readSubscriberStatus: () => {
      statusReadCount += 1;
      return Promise.resolve(inactiveSubscriberStatus());
    },
    resolveLocalProfiles: (subscriberIds: string[]) => {
      profileLookupCount += 1;
      return Promise.resolve(new Map(subscriberIds.map((id) => [id, id])));
    },
    applyEntitlementEvent: (
      appUserId: string,
      change: RevenueCatEntitlementChange,
      subscriberAttributes?: Record<string, SubscriberAttribute> | null,
    ) => {
      updates.push({ appUserId, change, subscriberAttributes });
      return Promise.resolve({ error: null, count: 1 });
    },
  };
  const handler = createRevenueCatWebhookHandler(dependencies);

  const knownResponse = await handler(
    await request(event('RENEWAL', ['Plus'])),
  );
  const unknownResponse = await handler(
    await request(event('INITIAL_PURCHASE', ['Other'])),
  );

  assertEquals(knownResponse.status, 200);
  assertEquals(await knownResponse.json(), { updated: 1 });
  assertEquals(unknownResponse.status, 200);
  assertEquals(await unknownResponse.json(), { ignored: 'unrelated_entitlement' });
  assertEquals(statusReadCount, 0);
  assertEquals(profileLookupCount, 0);
  assertEquals(updates.length, 1);
  assertEquals(updates[0]?.change.eventId, 'event-RENEWAL');
});

// **Validates: Requirements 3.8, 3.10**
Deno.test('Property 2: transfer replay keeps event IDs stable and resumes a missing change', async () => {
  const subscriberId = TRANSFER_OLD_LOCAL_ID;
  const acceptedChanges = new Set<string>();
  const attemptedChanges: RevenueCatEntitlementChange[] = [];
  const statusReads: string[] = [];
  let failFirstAiAttempt = true;
  const dependencies = {
    expectedSecret: SECRET,
    now: () => NOW,
    readSubscriberStatus: (readSubscriberId: string) => {
      statusReads.push(readSubscriberId);
      return Promise.resolve({
        entitlements: {
          Plus: { active: true, expiresAt: new Date(EXPIRATION).toISOString() },
          AI: { active: true, expiresAt: new Date(EXPIRATION).toISOString() },
        },
        subscriberAttributes: null,
      });
    },
    resolveLocalProfiles: (subscriberIds: string[]) =>
      Promise.resolve(new Map(subscriberIds.map((id) => [id, id]))),
    applyEntitlementEvent: (
      _appUserId: string,
      change: RevenueCatEntitlementChange,
    ) => {
      attemptedChanges.push(change);
      const deduplicationKey = `${change.eventId}:${change.entitlementId}`;
      if (acceptedChanges.has(deduplicationKey)) {
        return Promise.resolve({ error: null, count: 0 });
      }
      if (change.entitlementId === 'AI' && failFirstAiAttempt) {
        failFirstAiAttempt = false;
        return Promise.resolve({ error: { message: 'temporary_failure' }, count: null });
      }
      acceptedChanges.add(deduplicationKey);
      return Promise.resolve({ error: null, count: 1 });
    },
  };
  const handler = createRevenueCatWebhookHandler(dependencies);
  const transfer = preservationTransferEvent({
    id: 'event-transfer-replay',
    transferred_from: [subscriberId, subscriberId],
    transferred_to: [subscriberId],
  });

  const firstResponse = await handler(await request(transfer));
  const replayResponse = await handler(await request(transfer));

  assertEquals(firstResponse.status, 500);
  assertEquals(await firstResponse.json(), {
    error: 'update_failed',
    message: 'temporary_failure',
  });
  assertEquals(replayResponse.status, 200);
  assertEquals(await replayResponse.json(), { updated: 1 });
  assertEquals(statusReads, [subscriberId, subscriberId]);
  assertEquals(
    attemptedChanges.map(({ entitlementId, eventId }) => `${entitlementId}|${eventId}`),
    [
      `Plus|transfer:event-transfer-replay:${subscriberId}`,
      `AI|transfer:event-transfer-replay:${subscriberId}`,
      `Plus|transfer:event-transfer-replay:${subscriberId}`,
      `AI|transfer:event-transfer-replay:${subscriberId}`,
    ],
  );
  assertEquals(sorted(acceptedChanges), [
    `transfer:event-transfer-replay:${subscriberId}:AI`,
    `transfer:event-transfer-replay:${subscriberId}:Plus`,
  ]);
});

// **Validates: Requirements 3.7**
Deno.test('requires the transfer profile reader before local mutations', async () => {
  const statusReads: string[] = [];
  const updates: CapturedUpdate[] = [];
  const handler = createRevenueCatWebhookHandler({
    expectedSecret: SECRET,
    now: () => NOW,
    readSubscriberStatus: (subscriberId: string) => {
      statusReads.push(subscriberId);
      return Promise.resolve(inactiveSubscriberStatus());
    },
    applyEntitlementEvent: (
      appUserId: string,
      change: RevenueCatEntitlementChange,
      subscriberAttributes?: Record<string, SubscriberAttribute> | null,
    ) => {
      updates.push({ appUserId, change, subscriberAttributes });
      return Promise.resolve({ error: null, count: 1 });
    },
  });

  const response = await handler(
    await request(preservationTransferEvent()),
  );

  assertEquals(response.status, 503);
  assertEquals(await response.json(), {
    error: 'local_profile_resolver_unavailable',
  });
  assertEquals(occurrences(statusReads), [
    `${TRANSFER_OLD_LOCAL_ID}:1`,
    `${TRANSFER_NEW_LOCAL_ID}:1`,
  ]);
  assertEquals(updates, []);
});

// **Validates: Requirements 3.7**
Deno.test('retries failed transfer profile lookups without local mutations', async () => {
  let statusReadCount = 0;
  let profileLookupCount = 0;
  const updates: CapturedUpdate[] = [];
  const handler = createRevenueCatWebhookHandler({
    expectedSecret: SECRET,
    now: () => NOW,
    readSubscriberStatus: () => {
      statusReadCount += 1;
      return Promise.resolve(inactiveSubscriberStatus());
    },
    resolveLocalProfiles: () => {
      profileLookupCount += 1;
      return Promise.reject(new Error('database unavailable'));
    },
    applyEntitlementEvent: (
      appUserId: string,
      change: RevenueCatEntitlementChange,
      subscriberAttributes?: Record<string, SubscriberAttribute> | null,
    ) => {
      updates.push({ appUserId, change, subscriberAttributes });
      return Promise.resolve({ error: null, count: 1 });
    },
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await handler(
      await request(preservationTransferEvent()),
    );
    assertEquals(response.status, 500);
    assertEquals(await response.json(), {
      error: 'local_profile_lookup_failed',
    });
  }

  assertEquals(statusReadCount, 4);
  assertEquals(profileLookupCount, 2);
  assertEquals(updates, []);
});

// **Validates: Requirements 2.1, 3.8**
Deno.test('skips profile lookup when a transfer has no UUID-shaped IDs', async () => {
  const anonymousId = '$RCAnonymousID:only-external';
  const nonHexId = 'gggggggg-gggg-gggg-gggg-gggggggggggg';
  const statusReads: string[] = [];
  let profileLookupCount = 0;
  const updates: CapturedUpdate[] = [];
  const handler = createRevenueCatWebhookHandler({
    expectedSecret: SECRET,
    now: () => NOW,
    readSubscriberStatus: (subscriberId: string) => {
      statusReads.push(subscriberId);
      return Promise.resolve(inactiveSubscriberStatus());
    },
    resolveLocalProfiles: () => {
      profileLookupCount += 1;
      return Promise.resolve(new Map());
    },
    applyEntitlementEvent: (
      appUserId: string,
      change: RevenueCatEntitlementChange,
      subscriberAttributes?: Record<string, SubscriberAttribute> | null,
    ) => {
      updates.push({ appUserId, change, subscriberAttributes });
      return Promise.resolve({ error: null, count: 1 });
    },
  });

  const response = await handler(
    await request(
      preservationTransferEvent({
        transferred_from: [anonymousId, anonymousId],
        transferred_to: [nonHexId],
      }),
    ),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { updated: 0 });
  assertEquals(
    occurrences(statusReads),
    sorted([
      `${anonymousId}:1`,
      `${nonHexId}:1`,
    ]),
  );
  assertEquals(profileLookupCount, 0);
  assertEquals(updates, []);
});

// **Validates: Requirements 2.2, 3.8**
Deno.test('does not project UUID candidates without confirmed profiles', async () => {
  const profileLookupCandidates: string[][] = [];
  const updates: CapturedUpdate[] = [];
  const handler = createRevenueCatWebhookHandler({
    expectedSecret: SECRET,
    now: () => NOW,
    readSubscriberStatus: () => Promise.resolve(inactiveSubscriberStatus()),
    resolveLocalProfiles: (subscriberIds: string[]) => {
      profileLookupCandidates.push([...subscriberIds]);
      return Promise.resolve(new Map());
    },
    applyEntitlementEvent: (
      appUserId: string,
      change: RevenueCatEntitlementChange,
      subscriberAttributes?: Record<string, SubscriberAttribute> | null,
    ) => {
      updates.push({ appUserId, change, subscriberAttributes });
      return Promise.resolve({ error: null, count: 1 });
    },
  });

  const response = await handler(
    await request(
      preservationTransferEvent({
        transferred_from: [TRANSFER_NON_LOCAL_UUID, TRANSFER_NON_LOCAL_UUID],
        transferred_to: [TRANSFER_NON_LOCAL_UUID],
      }),
    ),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { updated: 0 });
  assertEquals(profileLookupCandidates, [[TRANSFER_NON_LOCAL_UUID]]);
  assertEquals(updates, []);
});

// **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 3.5, 3.6, 3.8, 3.10**
Deno.test('builds the complete mapped transfer plan before the first mutation', async () => {
  const oldSubscriberId = 'A1111111-A111-A111-A111-A11111111111';
  const newSubscriberId = 'B2222222-B222-B222-B222-B22222222222';
  const missingSubscriberId = 'C3333333-C333-C333-C333-C33333333333';
  const anonymousSubscriberId = '$RCAnonymousID:plan-barrier';
  const oldLocalProfileId = oldSubscriberId.toLowerCase();
  const newLocalProfileId = newSubscriberId.toLowerCase();
  const activeExpiration = new Date(EXPIRATION).toISOString();
  const oldStatusAttributes = {
    source_subscriber: { value: oldSubscriberId },
  };
  const fallbackAttributes = {
    household_id: { value: HOUSEHOLD_ID },
  };
  const trace: string[] = [];
  const statusReads: string[] = [];
  const profileLookups: string[][] = [];
  const updates: CapturedUpdate[] = [];

  const handler = createRevenueCatWebhookHandler({
    expectedSecret: SECRET,
    now: () => NOW,
    readSubscriberStatus: (subscriberId: string) => {
      statusReads.push(subscriberId);
      trace.push(`status:complete:${subscriberId}`);

      const entitlements: Partial<
        Record<'Plus' | 'AI', { active: boolean; expiresAt: string | null }>
      > = {};
      for (const entitlementId of ['Plus', 'AI'] as const) {
        Object.defineProperty(entitlements, entitlementId, {
          enumerable: true,
          get: () => {
            trace.push(`plan:${subscriberId}:${entitlementId}`);
            if (subscriberId === oldSubscriberId && entitlementId === 'AI') {
              return undefined;
            }

            const active = subscriberId === newSubscriberId;
            return {
              active,
              expiresAt: active ? activeExpiration : null,
            };
          },
        });
      }

      return Promise.resolve({
        entitlements,
        get subscriberAttributes() {
          trace.push(`attributes:${subscriberId}`);
          return subscriberId === oldSubscriberId ? oldStatusAttributes : undefined;
        },
      });
    },
    resolveLocalProfiles: (subscriberIds: string[]) => {
      profileLookups.push([...subscriberIds]);
      trace.push('profiles:complete');
      return Promise.resolve(
        new Map([
          [oldSubscriberId, oldLocalProfileId],
          [newSubscriberId, newLocalProfileId],
        ]),
      );
    },
    applyEntitlementEvent: (
      appUserId: string,
      change: RevenueCatEntitlementChange,
      subscriberAttributes?: Record<string, SubscriberAttribute> | null,
    ) => {
      trace.push(`projection:${appUserId}:${change.entitlementId}`);
      updates.push({ appUserId, change, subscriberAttributes });
      return Promise.resolve({ error: null, count: 1 });
    },
  });
  const response = await handler(
    await request({
      id: 'event-complete-transfer-plan',
      type: 'TRANSFER',
      environment: 'PRODUCTION',
      app_user_id: newSubscriberId,
      event_timestamp_ms: EVENT_TIMESTAMP,
      subscriber_attributes: fallbackAttributes,
      transferred_from: [anonymousSubscriberId, oldSubscriberId, oldSubscriberId],
      transferred_to: [missingSubscriberId, newSubscriberId, anonymousSubscriberId],
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { updated: 4 });
  assertEquals(
    occurrences(statusReads),
    sorted([
      `${anonymousSubscriberId}:1`,
      `${oldSubscriberId}:1`,
      `${missingSubscriberId}:1`,
      `${newSubscriberId}:1`,
    ]),
  );
  assertEquals(profileLookups.map((candidates) => sorted(candidates)), [
    sorted([
      missingSubscriberId,
      newSubscriberId,
      oldSubscriberId,
    ]),
  ]);
  assertEquals(
    normalizedProjections(updates),
    sorted([
      `${oldLocalProfileId}|Plus|inactive|null`,
      `${oldLocalProfileId}|AI|inactive|null`,
      `${newLocalProfileId}|Plus|active|${activeExpiration}`,
      `${newLocalProfileId}|AI|active|${activeExpiration}`,
    ]),
  );

  const firstProjection = trace.findIndex((entry) => entry.startsWith('projection:'));
  const profileLookupCompletion = trace.indexOf('profiles:complete');
  const planReads = trace
    .map((entry, index) =>
      entry.startsWith('plan:') || entry.startsWith('attributes:') ? index : -1
    )
    .filter((index) => index >= 0);
  assertEquals(firstProjection >= 0, true);
  assertEquals(profileLookupCompletion >= 0 && profileLookupCompletion < firstProjection, true);
  assertEquals(planReads.length > 0 && planReads.every((index) => index < firstProjection), true);
  assertEquals(
    occurrences(
      trace.filter((entry) => entry.startsWith('plan:') || entry.startsWith('attributes:')),
    ),
    sorted([
      `attributes:${oldSubscriberId}:1`,
      `attributes:${newSubscriberId}:1`,
      `plan:${oldSubscriberId}:Plus:1`,
      `plan:${oldSubscriberId}:AI:1`,
      `plan:${newSubscriberId}:Plus:1`,
      `plan:${newSubscriberId}:AI:1`,
    ]),
  );
  assertEquals(
    updates.map(({ appUserId, change }) => ({
      appUserId,
      entitlementId: change.entitlementId,
      eventId: change.eventId,
      eventTimestampMs: change.eventTimestampMs,
      processedAt: change.processedAt,
    })),
    [
      {
        appUserId: oldLocalProfileId,
        entitlementId: 'Plus',
        eventId: `transfer:event-complete-transfer-plan:${oldLocalProfileId}`,
        eventTimestampMs: EVENT_TIMESTAMP,
        processedAt: NOW.toISOString(),
      },
      {
        appUserId: oldLocalProfileId,
        entitlementId: 'AI',
        eventId: `transfer:event-complete-transfer-plan:${oldLocalProfileId}`,
        eventTimestampMs: EVENT_TIMESTAMP,
        processedAt: NOW.toISOString(),
      },
      {
        appUserId: newLocalProfileId,
        entitlementId: 'Plus',
        eventId: `transfer:event-complete-transfer-plan:${newLocalProfileId}`,
        eventTimestampMs: EVENT_TIMESTAMP,
        processedAt: NOW.toISOString(),
      },
      {
        appUserId: newLocalProfileId,
        entitlementId: 'AI',
        eventId: `transfer:event-complete-transfer-plan:${newLocalProfileId}`,
        eventTimestampMs: EVENT_TIMESTAMP,
        processedAt: NOW.toISOString(),
      },
    ],
  );
  assertEquals(
    updates.map(({ appUserId, subscriberAttributes }) => ({
      appUserId,
      subscriberAttributes,
    })),
    [
      { appUserId: oldLocalProfileId, subscriberAttributes: oldStatusAttributes },
      { appUserId: oldLocalProfileId, subscriberAttributes: oldStatusAttributes },
      { appUserId: newLocalProfileId, subscriberAttributes: fallbackAttributes },
      { appUserId: newLocalProfileId, subscriberAttributes: fallbackAttributes },
    ],
  );
});
