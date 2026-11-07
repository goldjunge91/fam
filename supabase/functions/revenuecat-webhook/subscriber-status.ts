import type { EntitlementId, RevenueCatSubscriberStatus, SubscriberAttribute } from './handler.ts';

export type RevenueCatSubscriberStatusFailureCategory =
  | 'configuration_missing'
  | 'configuration_invalid'
  | 'subscriber_not_found'
  | 'subscriber_lookup_failed'
  | 'network_failure'
  | 'response_parse_failure';

export class RevenueCatSubscriberStatusError extends Error {
  constructor(
    readonly failureCategory: RevenueCatSubscriberStatusFailureCategory,
    message: string,
    readonly upstreamStatus?: number,
  ) {
    super(message);
    this.name = 'RevenueCatSubscriberStatusError';
  }
}

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

const ISO_8601_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isIso8601Timestamp(value: string): boolean {
  const match = ISO_8601_TIMESTAMP_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[7] === undefined ? 0 : Number(match[7]);
  const offsetMinute = match[8] === undefined ? 0 : Number(match[8]);
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return (
    year > 0 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= (daysInMonth[month - 1] ?? 0) &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59 &&
    Number.isFinite(Date.parse(value))
  );
}

function readDate(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !isIso8601Timestamp(value)) {
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

function hasEligiblePurchase(
  productIdentifier: string,
  subscriptions: Record<string, RevenueCatApiSubscription>,
  nonSubscriptions: Record<string, RevenueCatApiNonSubscription[]>,
  allowSandbox: boolean,
): boolean {
  const subscription = subscriptions[productIdentifier];
  if (subscription) return allowSandbox || !subscription.is_sandbox;
  return nonSubscriptions[productIdentifier]?.some((purchase) =>
    allowSandbox || !purchase.is_sandbox
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
  allowSandboxAiEntitlement: boolean,
): RevenueCatSubscriberStatus {
  if (
    !isRecord(value) ||
    typeof value.request_date_ms !== 'number' ||
    !Number.isSafeInteger(value.request_date_ms) ||
    value.request_date_ms < 0 ||
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
    const eligiblePurchase = hasEligiblePurchase(
      entitlement.product_identifier,
      subscriptions,
      nonSubscriptions,
      entitlementId === 'AI' && allowSandboxAiEntitlement,
    );
    resolvedEntitlements[entitlementId] = {
      active: eligiblePurchase && isActiveAt(expiresAt, value.request_date_ms),
      expiresAt: eligiblePurchase ? expiresAt : null,
    };
  }

  return {
    entitlements: resolvedEntitlements,
    subscriberAttributes: parseSubscriberAttributes(subscriber.subscriber_attributes),
    requestDateMs: value.request_date_ms,
  };
}

function createRevenueCatStatusReader(
  secretApiKey: string | undefined,
  fetcher: typeof fetch,
  honorRevenueCatSandboxAiAccess: boolean,
): (appUserId: string) => Promise<RevenueCatSubscriberStatus> {
  return async (appUserId) => {
    if (!secretApiKey) {
      throw new RevenueCatSubscriberStatusError(
        'configuration_missing',
        'RevenueCat secret API key is not configured.',
      );
    }

    let response: Response;
    try {
      response = await fetcher(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
        {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${secretApiKey}`,
          },
        },
      );
    } catch {
      throw new RevenueCatSubscriberStatusError(
        'network_failure',
        'RevenueCat customer lookup failed before receiving a response.',
      );
    }

    if (!response.ok) {
      const failureCategory = response.status === 401 || response.status === 403
        ? 'configuration_invalid'
        : response.status === 404
        ? 'subscriber_not_found'
        : 'subscriber_lookup_failed';
      throw new RevenueCatSubscriberStatusError(
        failureCategory,
        `RevenueCat customer lookup failed (${response.status}).`,
        response.status,
      );
    }

    try {
      return parseSubscriberStatus(
        await response.json(),
        honorRevenueCatSandboxAiAccess,
      );
    } catch {
      throw new RevenueCatSubscriberStatusError(
        'response_parse_failure',
        'RevenueCat returned an invalid customer response.',
        response.status,
      );
    }
  };
}

export type RevenueCatSubscriberStatusReaderOptions = {
  allowSandboxAiEntitlement?: boolean;
};

/** Reads status for reconciliation, with an explicit AI-only sandbox exception. */
export function createRevenueCatSubscriberStatusReader(
  secretApiKey: string | undefined,
  fetcher: typeof fetch = fetch,
  options: RevenueCatSubscriberStatusReaderOptions = {},
): (appUserId: string) => Promise<RevenueCatSubscriberStatus> {
  return createRevenueCatStatusReader(
    secretApiKey,
    fetcher,
    options.allowSandboxAiEntitlement === true,
  );
}
