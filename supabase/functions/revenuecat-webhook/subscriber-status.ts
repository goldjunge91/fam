import type { EntitlementId, RevenueCatSubscriberStatus, SubscriberAttribute } from './handler.ts';

type RevenueCatApiEntitlement = {
  expires_date: string | null;
  grace_period_expires_date: string | null;
  product_identifier: string;
};

type RevenueCatApiSubscription = {
  is_sandbox: boolean;
};

type RevenueCatApiNonSubscription = {
  is_sandbox: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readDate(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`RevenueCat returned an invalid ${field}.`);
  }
  return new Date(value).toISOString();
}

function parseEntitlement(value: unknown): RevenueCatApiEntitlement {
  if (
    !isRecord(value) ||
    typeof value.product_identifier !== 'string' ||
    value.product_identifier.length === 0
  ) {
    throw new Error('RevenueCat returned an invalid entitlement.');
  }

  return {
    product_identifier: value.product_identifier,
    expires_date: readDate(value.expires_date, 'entitlement expiry'),
    grace_period_expires_date: readDate(
      value.grace_period_expires_date,
      'entitlement grace-period expiry',
    ),
  };
}

function parseSubscription(value: unknown): RevenueCatApiSubscription {
  if (!isRecord(value) || typeof value.is_sandbox !== 'boolean') {
    throw new Error('RevenueCat returned an invalid subscription.');
  }
  return { is_sandbox: value.is_sandbox };
}

function parseNonSubscription(value: unknown): RevenueCatApiNonSubscription[] {
  if (!Array.isArray(value)) throw new Error('RevenueCat returned invalid non-subscriptions.');
  return value.map((purchase) => {
    if (!isRecord(purchase) || typeof purchase.is_sandbox !== 'boolean') {
      throw new Error('RevenueCat returned an invalid non-subscription purchase.');
    }
    return { is_sandbox: purchase.is_sandbox };
  });
}

function parseSubscriberAttributes(value: unknown): Record<string, SubscriberAttribute> | null {
  if (value == null) return null;
  if (!isRecord(value)) throw new Error('RevenueCat returned invalid subscriber attributes.');

  const attributes: Record<string, SubscriberAttribute> = {};
  for (const [key, candidate] of Object.entries(value)) {
    if (!isRecord(candidate) || typeof candidate.value !== 'string') continue;
    if (
      candidate.updated_at_ms !== undefined &&
      (typeof candidate.updated_at_ms !== 'number' || !Number.isFinite(candidate.updated_at_ms))
    ) {
      continue;
    }
    attributes[key] = {
      value: candidate.value,
      ...(typeof candidate.updated_at_ms === 'number'
        ? { updated_at_ms: candidate.updated_at_ms }
        : {}),
    };
  }
  return attributes;
}

function hasPermittedPurchase(
  productIdentifier: string,
  subscriptions: Record<string, RevenueCatApiSubscription>,
  nonSubscriptions: Record<string, RevenueCatApiNonSubscription[]>,
  allowSandbox: boolean,
): boolean {
  const subscription = subscriptions[productIdentifier];
  if (subscription) return allowSandbox || !subscription.is_sandbox;
  return nonSubscriptions[productIdentifier]?.some(
    (purchase) => allowSandbox || !purchase.is_sandbox,
  ) ?? false;
}

function activeUntil(entitlement: RevenueCatApiEntitlement): string | null {
  if (entitlement.expires_date === null) return null;
  const expiry = Date.parse(entitlement.expires_date);
  const graceExpiry = entitlement.grace_period_expires_date === null
    ? expiry
    : Date.parse(entitlement.grace_period_expires_date);
  return new Date(Math.max(expiry, graceExpiry)).toISOString();
}

function isActiveAt(expiry: string | null, requestDateMs: number): boolean {
  return expiry === null || Date.parse(expiry) > requestDateMs;
}

function parseSubscriberStatus(
  value: unknown,
  { allowSandbox = false }: { allowSandbox?: boolean } = {},
): RevenueCatSubscriberStatus {
  if (
    !isRecord(value) ||
    typeof value.request_date_ms !== 'number' ||
    !Number.isFinite(value.request_date_ms) ||
    !isRecord(value.subscriber)
  ) {
    throw new Error('RevenueCat returned an invalid customer response.');
  }

  const subscriber = value.subscriber;
  if (!isRecord(subscriber.entitlements) || !isRecord(subscriber.subscriptions)) {
    throw new Error('RevenueCat returned an invalid customer response.');
  }

  const entitlements = subscriber.entitlements;
  const subscriptions: Record<string, RevenueCatApiSubscription> = {};
  for (const [productIdentifier, candidate] of Object.entries(subscriber.subscriptions)) {
    subscriptions[productIdentifier] = parseSubscription(candidate);
  }

  const nonSubscriptions: Record<string, RevenueCatApiNonSubscription[]> = {};
  if (subscriber.non_subscriptions !== undefined) {
    if (!isRecord(subscriber.non_subscriptions)) {
      throw new Error('RevenueCat returned invalid non-subscriptions.');
    }
    for (const [productIdentifier, candidate] of Object.entries(subscriber.non_subscriptions)) {
      nonSubscriptions[productIdentifier] = parseNonSubscription(candidate);
    }
  }

  const resolvedEntitlements: Partial<
    Record<EntitlementId, { active: boolean; expiresAt: string | null }>
  > = {};
  for (const entitlementId of ['Plus', 'AI'] as const) {
    const candidate = entitlements[entitlementId];
    if (candidate === undefined) continue;

    const entitlement = parseEntitlement(candidate);
    const expiresAt = activeUntil(entitlement);
    const permittedPurchase = hasPermittedPurchase(
      entitlement.product_identifier,
      subscriptions,
      nonSubscriptions,
      allowSandbox,
    );
    resolvedEntitlements[entitlementId] = {
      active: permittedPurchase && isActiveAt(expiresAt, value.request_date_ms),
      expiresAt: permittedPurchase ? expiresAt : null,
    };
  }

  return {
    entitlements: resolvedEntitlements,
    subscriberAttributes: parseSubscriberAttributes(subscriber.subscriber_attributes),
    requestDateMs: value.request_date_ms,
  };
}

/** Reads production status by default; callers may allow sandbox only for local Supabase. */
export function createRevenueCatSubscriberStatusReader(
  secretApiKey: string | undefined,
  fetcher: typeof fetch = fetch,
  { allowSandbox = false }: { allowSandbox?: boolean } = {},
): (appUserId: string) => Promise<RevenueCatSubscriberStatus> {
  return async (appUserId) => {
    if (!secretApiKey) throw new Error('RevenueCat secret API key is not configured.');

    const response = await fetcher(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${secretApiKey}`,
        },
      },
    );
    if (!response.ok) throw new Error(`RevenueCat customer lookup failed (${response.status}).`);

    return parseSubscriberStatus(await response.json(), { allowSandbox });
  };
}
