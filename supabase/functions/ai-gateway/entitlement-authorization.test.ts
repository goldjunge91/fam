import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';

import {
  type AiHouseholdProjection,
  createAiEntitlementAuthorizer,
  readAiEntitlementServerConfig,
} from './entitlement-authorization.ts';
import type { RevenueCatSubscriberStatus } from '../revenuecat-webhook/handler.ts';
import { RevenueCatSubscriberStatusError } from '../revenuecat-webhook/subscriber-status.ts';

const REQUEST_DATE_MS = Date.parse('2026-08-16T08:00:00.000Z');
const FUTURE_EXPIRY = '2026-09-01T08:00:00.000Z';
const CONFIGURATION_ERROR = 'AI gateway privileged configuration is missing or invalid.';

function validSecretKey(): string {
  return ['sb', 'secret', 'unit_test_value'].join('_');
}

function secretKeysJson(defaultSecretKey: string): string {
  return JSON.stringify({ default: defaultSecretKey });
}

Deno.test('reads privileged config without consulting the sandbox switch outside development', () => {
  const reads: string[] = [];
  const expectedSecretKey = validSecretKey();

  const config = readAiEntitlementServerConfig((name) => {
    reads.push(name);
    return name === 'SUPABASE_SECRET_KEYS'
      ? `  ${secretKeysJson(`  ${expectedSecretKey}  `)}  `
      : undefined;
  });

  assert(config.supabaseSecretKey === expectedSecretKey);
  assertEquals(config.allowSandboxEntitlements, false);
  assertEquals(reads, ['SUPABASE_SECRET_KEYS', 'FAM_ENVIRONMENT']);
});

for (
  const [label, environment, setting, expected] of [
    ['development with an absent setting', 'development', undefined, false],
    ['development with an empty setting', 'development', '', false],
    ['development with false', 'development', 'false', false],
    ['development with differently cased true', 'development', 'TRUE', false],
    ['development with a misspelling', 'development', 'tru', false],
    ['development with a numeric truthy value', 'development', '1', false],
    ['development with lowercase true', 'development', 'true', true],
    ['trimmed development with trimmed lowercase true', '  development  ', '  true  ', true],
    ['an absent environment with true', undefined, 'true', false],
    ['production with true', 'production', 'true', false],
    ['staging with true', 'staging', 'true', false],
    ['differently cased development with true', 'DEVELOPMENT', 'true', false],
  ] as const
) {
  Deno.test(`maps ${label} to sandbox access ${expected}`, () => {
    const config = readAiEntitlementServerConfig((name) => {
      if (name === 'SUPABASE_SECRET_KEYS') return secretKeysJson(validSecretKey());
      if (name === 'FAM_ENVIRONMENT') return environment;
      return setting;
    });

    assertEquals(config.allowSandboxEntitlements, expected);
  });
}

for (
  const [label, secretKey] of [
    ['an absent secret key', undefined],
    ['an empty secret key', '   '],
    ['malformed JSON', '{"default":'],
    ['a missing default key', JSON.stringify({ secondary: validSecretKey() })],
    ['a non-object secret map', JSON.stringify([validSecretKey()])],
    ['a non-string default key', JSON.stringify({ default: 123 })],
    ['an empty default key', JSON.stringify({ default: '  ' })],
    ['a non-opaque key', 'legacy-value'],
    ['a publishable key', ['sb', 'publishable', 'unit_test_value'].join('_')],
    ['a prefix-only key', ['sb', 'secret', ''].join('_')],
    ['a key containing whitespace', `${validSecretKey()} invalid`],
    ['a plain key instead of a secret map', validSecretKey()],
  ] as const
) {
  Deno.test(`rejects ${label} with a fixed value-free configuration error`, () => {
    assertThrows(
      () =>
        readAiEntitlementServerConfig((name) =>
          name === 'SUPABASE_SECRET_KEYS' ? secretKey : undefined
        ),
      Error,
      CONFIGURATION_ERROR,
    );
  });
}

function subscriberStatus(
  active: boolean,
  expiresAt: string | null = active ? FUTURE_EXPIRY : null,
): RevenueCatSubscriberStatus {
  return {
    entitlements: { AI: { active, expiresAt } },
    requestDateMs: REQUEST_DATE_MS,
  };
}

type SetupOptions = {
  projection?: AiHouseholdProjection | null;
  projectionLookupFails?: boolean;
  status?: RevenueCatSubscriberStatus;
  statusError?: Error;
  assignmentSucceeds?: boolean;
  deactivationSucceeds?: boolean;
  allowAuthenticatedUserRecovery?: boolean;
};

function setup(options: SetupOptions = {}) {
  let projection: AiHouseholdProjection | null = options.projection === undefined
    ? {
      ai_active: true,
      ai_expires_at: FUTURE_EXPIRY,
      ai_subscriber_id: 'projected-subscriber',
    }
    : options.projection;
  const projectionReads: Array<{ householdId: string; authorization: string }> = [];
  const statusReads: string[] = [];
  const assignments: Array<{
    subscriberUserId: string;
    householdId: string;
    entitlementExpiresAt: string | null;
    eventTimestampMs: number;
  }> = [];
  const deactivations: Array<{ subscriberUserId: string; eventTimestampMs: number }> = [];
  const failureLogs: Array<{
    event: string;
    failureCategory: string;
    requestId: string;
    upstreamStatus?: number;
  }> = [];

  const authorizer = createAiEntitlementAuthorizer({
    allowAuthenticatedUserRecovery: options.allowAuthenticatedUserRecovery ?? false,
    readHouseholdProjection: ({ householdId, authorization }) => {
      projectionReads.push({ householdId, authorization });
      return Promise.resolve(
        options.projectionLookupFails ? { ok: false as const } : { ok: true as const, projection },
      );
    },
    readSubscriberStatus: (subscriberUserId) => {
      statusReads.push(subscriberUserId);
      if (options.statusError) return Promise.reject(options.statusError);
      return Promise.resolve(options.status ?? subscriberStatus(true));
    },
    assignAiHousehold: (input) => {
      assignments.push(input);
      if (options.assignmentSucceeds === false) return Promise.resolve(false);
      projection = {
        ai_active: true,
        ai_expires_at: input.entitlementExpiresAt,
        ai_subscriber_id: input.subscriberUserId,
      };
      return Promise.resolve(true);
    },
    deactivateAiHousehold: (input) => {
      deactivations.push(input);
      if (options.deactivationSucceeds === false) return Promise.resolve(false);
      projection = projection === null ? null : {
        ...projection,
        ai_active: false,
        ai_expires_at: null,
        ai_subscriber_id: null,
      };
      return Promise.resolve(true);
    },
    logStatusFailure: (failure) => failureLogs.push(failure),
    nowMs: () => REQUEST_DATE_MS,
  });

  return {
    authorizer,
    projectionReads,
    statusReads,
    assignments,
    deactivations,
    failureLogs,
    getProjection: () => projection,
  };
}

Deno.test('refreshes an active projected entitlement for the requested household', async () => {
  const harness = setup({
    projection: {
      ai_active: false,
      ai_expires_at: null,
      ai_subscriber_id: 'projected-subscriber',
    },
  });

  const result = await harness.authorizer(
    'authenticated-user',
    'requested-household',
    'Bearer user-token',
  );

  assertEquals(result, { ok: true, subscriberUserId: 'projected-subscriber' });
  assertEquals(harness.projectionReads, [{
    householdId: 'requested-household',
    authorization: 'Bearer user-token',
  }]);
  assertEquals(harness.statusReads, ['projected-subscriber']);
  assertEquals(harness.assignments, [{
    subscriberUserId: 'projected-subscriber',
    householdId: 'requested-household',
    entitlementExpiresAt: FUTURE_EXPIRY,
    eventTimestampMs: REQUEST_DATE_MS,
  }]);
  assertEquals(harness.deactivations, []);
});

Deno.test('keeps a matching active projection without an unnecessary mutation', async () => {
  const harness = setup();

  const result = await harness.authorizer(
    'authenticated-user',
    'requested-household',
    'Bearer user-token',
  );

  assertEquals(result, { ok: true, subscriberUserId: 'projected-subscriber' });
  assertEquals(harness.assignments, []);
  assertEquals(harness.deactivations, []);
});

Deno.test('returns 402, deactivates, then restores the missing-projection 403', async () => {
  const harness = setup({
    status: subscriberStatus(false),
    allowAuthenticatedUserRecovery: true,
  });

  const firstResult = await harness.authorizer(
    'authenticated-user',
    'requested-household',
    'Bearer user-token',
  );
  const secondResult = await harness.authorizer(
    'authenticated-user',
    'requested-household',
    'Bearer user-token',
  );

  assertEquals(firstResult, {
    ok: false,
    status: 402,
    error: 'ai_subscription_required',
  });
  assertEquals(secondResult, {
    ok: false,
    status: 403,
    error: 'ai_entitlement_missing',
  });
  assertEquals(harness.statusReads, ['projected-subscriber', 'authenticated-user']);
  assertEquals(harness.deactivations, [{
    subscriberUserId: 'projected-subscriber',
    eventTimestampMs: REQUEST_DATE_MS,
  }]);
  assertEquals(harness.getProjection()?.ai_subscriber_id, null);
});

Deno.test('denies a missing projection without server-enabled recovery', async () => {
  const harness = setup({ projection: null });

  const result = await harness.authorizer(
    'authenticated-user',
    'requested-household',
    'Bearer user-token',
  );

  assertEquals(result, {
    ok: false,
    status: 403,
    error: 'ai_entitlement_missing',
  });
  assertEquals(harness.statusReads, []);
  assertEquals(harness.assignments, []);
  assertEquals(harness.deactivations, []);
});

Deno.test('recovers a missing projection from the authenticated user after live confirmation', async () => {
  const harness = setup({
    projection: {
      ai_active: false,
      ai_expires_at: null,
      ai_subscriber_id: null,
    },
    allowAuthenticatedUserRecovery: true,
  });

  const firstResult = await harness.authorizer(
    'authenticated-user',
    'requested-household',
    'Bearer user-token',
  );
  const secondResult = await harness.authorizer(
    'authenticated-user',
    'requested-household',
    'Bearer user-token',
  );

  assertEquals(firstResult, { ok: true, subscriberUserId: 'authenticated-user' });
  assertEquals(secondResult, { ok: true, subscriberUserId: 'authenticated-user' });
  assertEquals(harness.statusReads, ['authenticated-user', 'authenticated-user']);
  assertEquals(harness.assignments, [{
    subscriberUserId: 'authenticated-user',
    householdId: 'requested-household',
    entitlementExpiresAt: FUTURE_EXPIRY,
    eventTimestampMs: REQUEST_DATE_MS,
  }]);
  assertEquals(harness.deactivations, []);
});

Deno.test('scopes projection recovery to the requested household without reading another household', async () => {
  const projections = new Map<string, AiHouseholdProjection | null>([
    ['requested-household', null],
    ['other-household', {
      ai_active: true,
      ai_expires_at: FUTURE_EXPIRY,
      ai_subscriber_id: 'other-subscriber',
    }],
  ]);
  const projectionReads: string[] = [];
  const assignments: string[] = [];
  let deactivationCount = 0;
  const authorizer = createAiEntitlementAuthorizer({
    allowAuthenticatedUserRecovery: true,
    readHouseholdProjection: ({ householdId }) => {
      projectionReads.push(householdId);
      return Promise.resolve({
        ok: true as const,
        projection: projections.get(householdId) ?? null,
      });
    },
    readSubscriberStatus: (subscriberUserId) => {
      assertEquals(subscriberUserId, 'authenticated-user');
      return Promise.resolve(subscriberStatus(true));
    },
    assignAiHousehold: (input) => {
      assignments.push(input.householdId);
      projections.set(input.householdId, {
        ai_active: true,
        ai_expires_at: input.entitlementExpiresAt,
        ai_subscriber_id: input.subscriberUserId,
      });
      return Promise.resolve(true);
    },
    deactivateAiHousehold: () => {
      deactivationCount += 1;
      return Promise.resolve(true);
    },
  });

  assertEquals(
    await authorizer(
      'authenticated-user',
      'requested-household',
      'Bearer user-token',
    ),
    { ok: true, subscriberUserId: 'authenticated-user' },
  );
  assertEquals(projectionReads, ['requested-household']);
  assertEquals(assignments, ['requested-household']);
  assertEquals(deactivationCount, 0);
  assertEquals(projections.get('other-household'), {
    ai_active: true,
    ai_expires_at: FUTURE_EXPIRY,
    ai_subscriber_id: 'other-subscriber',
  });
});

Deno.test('keeps inactive recovery candidates fail-closed without assigning access', async () => {
  const harness = setup({
    projection: null,
    status: subscriberStatus(false),
    allowAuthenticatedUserRecovery: true,
  });

  const result = await harness.authorizer(
    'authenticated-user',
    'requested-household',
    'Bearer user-token',
  );

  assertEquals(result, {
    ok: false,
    status: 403,
    error: 'ai_entitlement_missing',
  });
  assertEquals(harness.statusReads, ['authenticated-user']);
  assertEquals(harness.assignments, []);
  assertEquals(harness.deactivations, []);
});

Deno.test('fails closed for projection lookup and RevenueCat status failures', async () => {
  const projectionFailure = setup({ projectionLookupFails: true });
  assertEquals(
    await projectionFailure.authorizer(
      'authenticated-user',
      'requested-household',
      'Bearer user-token',
    ),
    { ok: false, status: 500, error: 'ai_household_lookup_failed' },
  );
  assertEquals(projectionFailure.statusReads, []);

  const statusFailure = setup({
    statusError: new RevenueCatSubscriberStatusError(
      'response_parse_failure',
      'Invalid upstream response.',
      200,
    ),
  });
  assertEquals(
    await statusFailure.authorizer(
      'authenticated-user',
      'requested-household',
      'Bearer user-token',
      'status-request-42',
    ),
    { ok: false, status: 503, error: 'ai_status_unavailable' },
  );
  assertEquals(statusFailure.assignments, []);
  assertEquals(statusFailure.deactivations, []);
  assertEquals(statusFailure.failureLogs, [{
    event: 'ai_gateway_revenuecat_status_failed',
    failureCategory: 'response_parse_failure',
    requestId: 'status-request-42',
    upstreamStatus: 200,
  }]);
});

Deno.test('fails closed when assignment or deactivation cannot be applied', async () => {
  const assignmentFailure = setup({
    projection: {
      ai_active: false,
      ai_expires_at: null,
      ai_subscriber_id: 'projected-subscriber',
    },
    assignmentSucceeds: false,
  });
  assertEquals(
    await assignmentFailure.authorizer(
      'authenticated-user',
      'requested-household',
      'Bearer user-token',
    ),
    { ok: false, status: 503, error: 'ai_status_refresh_failed' },
  );

  const deactivationFailure = setup({
    status: subscriberStatus(false),
    deactivationSucceeds: false,
  });
  assertEquals(
    await deactivationFailure.authorizer(
      'authenticated-user',
      'requested-household',
      'Bearer user-token',
    ),
    { ok: false, status: 503, error: 'ai_status_refresh_failed' },
  );
});
