import type { RevenueCatSubscriberStatus } from '../revenuecat-webhook/handler.ts';
import { readDefaultSupabaseKey } from '../_shared/supabase-keys.ts';
import {
  RevenueCatSubscriberStatusError,
  type RevenueCatSubscriberStatusFailureCategory,
} from '../revenuecat-webhook/subscriber-status.ts';

const CONFIGURATION_ERROR = 'AI gateway privileged configuration is missing or invalid.';

type AiEntitlementServerEnvironmentName =
  | 'SUPABASE_SECRET_KEYS'
  | 'FAM_ENVIRONMENT'
  | 'AI_ALLOW_SANDBOX_ENTITLEMENTS';

export type AiEntitlementServerConfig = {
  supabaseSecretKey: string;
  allowSandboxEntitlements: boolean;
};

/** Reads and validates the server-only settings used for AI entitlement checks. */
export function readAiEntitlementServerConfig(
  readEnvironment: (name: AiEntitlementServerEnvironmentName) => string | undefined,
): AiEntitlementServerConfig {
  const supabaseSecretKey = readDefaultSupabaseKey(
    readEnvironment('SUPABASE_SECRET_KEYS'),
    'secret',
  );
  const environment = readEnvironment('FAM_ENVIRONMENT')?.trim();
  const allowSandboxEntitlements = environment === 'development' &&
    readEnvironment('AI_ALLOW_SANDBOX_ENTITLEMENTS')?.trim() === 'true';

  if (
    !supabaseSecretKey
  ) {
    throw new Error(CONFIGURATION_ERROR);
  }

  return { supabaseSecretKey, allowSandboxEntitlements };
}

export type AiHouseholdProjection = {
  ai_active: boolean;
  ai_expires_at: string | null;
  ai_subscriber_id: string | null;
};

type AiEntitlementResult =
  | { ok: true; subscriberUserId: string }
  | { ok: false; status: number; error: string };

type ProjectionReadResult =
  | { ok: true; projection: AiHouseholdProjection | null }
  | { ok: false };

type AssignmentInput = {
  subscriberUserId: string;
  householdId: string;
  entitlementExpiresAt: string | null;
  eventTimestampMs: number;
};

type DeactivationInput = {
  subscriberUserId: string;
  eventTimestampMs: number;
};

type StatusFailureLog = {
  event: 'ai_gateway_revenuecat_status_failed';
  requestId: string;
  failureCategory: RevenueCatSubscriberStatusFailureCategory | 'unexpected_failure';
  upstreamStatus?: number;
};

type AiEntitlementAuthorizerDependencies = {
  allowAuthenticatedUserRecovery: boolean;
  readHouseholdProjection: (input: {
    householdId: string;
    authorization: string;
    requestId: string;
  }) => Promise<ProjectionReadResult>;
  readSubscriberStatus: (subscriberUserId: string) => Promise<RevenueCatSubscriberStatus>;
  assignAiHousehold: (input: AssignmentInput) => Promise<boolean>;
  deactivateAiHousehold: (input: DeactivationInput) => Promise<boolean>;
  logStatusFailure?: (failure: StatusFailureLog) => void;
  nowMs?: () => number;
};

function defaultStatusFailureLogger(failure: StatusFailureLog): void {
  console.error(JSON.stringify(failure));
}

/** Confirms live RevenueCat AI access before refreshing the requested household projection. */
export function createAiEntitlementAuthorizer(
  dependencies: AiEntitlementAuthorizerDependencies,
): (
  userId: string,
  householdId: string,
  authorization: string,
  requestId?: string,
) => Promise<AiEntitlementResult> {
  const logStatusFailure = dependencies.logStatusFailure ?? defaultStatusFailureLogger;
  const nowMs = dependencies.nowMs ?? Date.now;

  return async (userId, householdId, authorization, requestId = crypto.randomUUID()) => {
    let projectionResult: ProjectionReadResult;
    try {
      projectionResult = await dependencies.readHouseholdProjection({
        householdId,
        authorization,
        requestId,
      });
    } catch {
      return { ok: false, status: 500, error: 'ai_household_lookup_failed' };
    }

    if (!projectionResult.ok) {
      return { ok: false, status: 500, error: 'ai_household_lookup_failed' };
    }

    const projection = projectionResult.projection;
    const projectedSubscriberUserId = projection?.ai_subscriber_id?.trim() || null;
    if (!projectedSubscriberUserId && !dependencies.allowAuthenticatedUserRecovery) {
      return { ok: false, status: 403, error: 'ai_entitlement_missing' };
    }
    const subscriberUserId = projectedSubscriberUserId ?? userId;

    try {
      const status = await dependencies.readSubscriberStatus(subscriberUserId);
      const entitlement = status.entitlements.AI ?? {
        active: false,
        expiresAt: null,
      };
      const eventTimestampMs = status.requestDateMs ?? nowMs();

      if (entitlement.active) {
        const currentExpiryMs = projection?.ai_expires_at === null || !projection
          ? null
          : Date.parse(projection.ai_expires_at);
        const confirmedExpiryMs = entitlement.expiresAt === null
          ? null
          : Date.parse(entitlement.expiresAt);
        const projectionMatches = projection?.ai_active === true &&
          projection.ai_subscriber_id === subscriberUserId &&
          currentExpiryMs === confirmedExpiryMs;

        if (
          !projectionMatches &&
          !(await dependencies.assignAiHousehold({
            subscriberUserId,
            householdId,
            entitlementExpiresAt: entitlement.expiresAt,
            eventTimestampMs,
          }))
        ) {
          return { ok: false, status: 503, error: 'ai_status_refresh_failed' };
        }

        return { ok: true, subscriberUserId };
      }

      if (!projectedSubscriberUserId) {
        return { ok: false, status: 403, error: 'ai_entitlement_missing' };
      }

      if (
        projection?.ai_active === true &&
        projection.ai_subscriber_id === subscriberUserId &&
        !(await dependencies.deactivateAiHousehold({
          subscriberUserId,
          eventTimestampMs,
        }))
      ) {
        return { ok: false, status: 503, error: 'ai_status_refresh_failed' };
      }

      return { ok: false, status: 402, error: 'ai_subscription_required' };
    } catch (error) {
      const revenueCatFailure = error instanceof RevenueCatSubscriberStatusError ? error : null;
      logStatusFailure({
        event: 'ai_gateway_revenuecat_status_failed',
        requestId,
        failureCategory: revenueCatFailure?.failureCategory ?? 'unexpected_failure',
        ...(revenueCatFailure?.upstreamStatus === undefined
          ? {}
          : { upstreamStatus: revenueCatFailure.upstreamStatus }),
      });
      return { ok: false, status: 503, error: 'ai_status_unavailable' };
    }
  };
}
