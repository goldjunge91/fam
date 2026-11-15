import { createClient } from 'jsr:@supabase/supabase-js@2';

import { requireEnv, requireSupabaseSecretKey } from '../_shared/env.ts';
import {
  isLocalSupabaseUrl,
  isRevenueCatSandboxAllowed,
} from '../_shared/revenuecat-environment.ts';
import { activeAiAssignmentHouseholdId } from '../revenuecat-webhook/handler.ts';
import { createRevenueCatSubscriberStatusReader } from '../revenuecat-webhook/subscriber-status.ts';

const supabaseUrl = requireEnv('SUPABASE_URL');
const anonKey = requireEnv('SUPABASE_ANON_KEY');
const adminClient = createClient(supabaseUrl, requireSupabaseSecretKey());
const readRevenueCatStatus = createRevenueCatSubscriberStatusReader(
  Deno.env.get('REVENUECAT_SECRET_API_KEY'),
  fetch,
  { allowSandbox: isRevenueCatSandboxAllowed(supabaseUrl) },
);

const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  if (status >= 400 && isRecord(body) && typeof body.error === 'string') {
    console.warn(JSON.stringify({
      event: 'revenuecat_entitlement_sync',
      status,
      error: body.error,
    }));
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function parseLocalEntitlement(
  value: unknown,
): { active: boolean; expiresAt: string | null } | null {
  if (!isRecord(value) || typeof value.active !== 'boolean') return null;
  if (value.expiresAt !== null && typeof value.expiresAt !== 'string') return null;

  if (value.expiresAt === null) {
    return { active: value.active, expiresAt: null };
  }

  const expiresAtMs = Date.parse(value.expiresAt);
  if (!Number.isFinite(expiresAtMs)) return null;
  const active = value.active && expiresAtMs > Date.now();
  return { active, expiresAt: active ? new Date(expiresAtMs).toISOString() : null };
}

function userClient(authorization: string) {
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
}

async function resolveHouseholdId(
  userId: string,
  requestedHouseholdId: string | null,
  subscriberHouseholdId: string | null,
): Promise<{ householdId: string | null; forbidden: boolean }> {
  const preferredHouseholdId = requestedHouseholdId ?? subscriberHouseholdId;
  if (preferredHouseholdId) {
    const { data, error } = await adminClient
      .from('household_members')
      .select('household_id')
      .eq('household_id', preferredHouseholdId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (data) return { householdId: data.household_id, forbidden: false };
    if (requestedHouseholdId) return { householdId: null, forbidden: true };
  }

  const { data, error } = await adminClient
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return { householdId: data?.household_id ?? null, forbidden: false };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'missing_authorization' }, 401);

  const { data: authData, error: authError } = await userClient(authorization).auth.getUser();
  const userId = authData.user?.id;
  if (authError || !userId) return json({ error: 'unauthorized' }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!isRecord(body)) return json({ error: 'invalid_request' }, 400);

  const requestedHouseholdId = body.householdId;
  if (
    requestedHouseholdId !== undefined && requestedHouseholdId !== null &&
    !isUuid(requestedHouseholdId)
  ) {
    return json({ error: 'invalid_household_id' }, 400);
  }

  let status: Awaited<ReturnType<typeof readRevenueCatStatus>>;
  if (isLocalSupabaseUrl(supabaseUrl)) {
    // Test Store CustomerInfo is sufficient for the disposable local stack. Never trust this
    // client payload when the function is connected to a hosted Supabase project.
    const localEntitlement = parseLocalEntitlement(body.localEntitlement);
    if (!localEntitlement) return json({ error: 'local_entitlement_required' }, 400);
    status = {
      entitlements: { AI: localEntitlement },
      subscriberAttributes: null,
      requestDateMs: Date.now(),
    };
  } else {
    try {
      // Production status always comes from RevenueCat using the verified Supabase identity.
      status = await readRevenueCatStatus(userId);
    } catch {
      return json({ error: 'revenuecat_status_unavailable' }, 503);
    }
  }

  const entitlement = status.entitlements.AI ?? { active: false, expiresAt: null };
  const eventTimestampMs = status.requestDateMs ?? Date.now();

  if (!entitlement.active) {
    const { error } = await adminClient.rpc('deactivate_ai_household', {
      p_subscriber_user_id: userId,
      p_event_timestamp_ms: eventTimestampMs,
    });
    if (error) return json({ error: 'ai_entitlement_update_failed' }, 503);
    return json({ active: false });
  }

  const { data: assignment, error: assignmentError } = await adminClient
    .from('revenuecat_ai_assignments')
    .select('household_id, active')
    .eq('subscriber_user_id', userId)
    .maybeSingle();
  if (assignmentError) return json({ error: 'ai_assignment_lookup_failed' }, 503);

  let householdId = activeAiAssignmentHouseholdId(assignment);
  if (!householdId) {
    let resolved: { householdId: string | null; forbidden: boolean };
    try {
      const subscriberHouseholdAttribute = status.subscriberAttributes?.household_id?.value;
      const subscriberHouseholdId = isUuid(subscriberHouseholdAttribute)
        ? subscriberHouseholdAttribute
        : null;
      resolved = await resolveHouseholdId(
        userId,
        typeof requestedHouseholdId === 'string' ? requestedHouseholdId : null,
        subscriberHouseholdId,
      );
    } catch {
      return json({ error: 'household_lookup_failed' }, 503);
    }
    if (resolved.forbidden) return json({ error: 'household_forbidden' }, 403);
    householdId = resolved.householdId;
  }

  if (!householdId) return json({ error: 'household_missing' }, 409);

  const { error: updateError } = await adminClient.rpc('assign_ai_household', {
    p_subscriber_user_id: userId,
    p_target_household_id: householdId,
    p_entitlement_expires_at: entitlement.expiresAt,
    p_event_timestamp_ms: eventTimestampMs,
  });
  if (updateError) return json({ error: 'ai_entitlement_update_failed' }, 503);

  return json({ active: true, householdId, expiresAt: entitlement.expiresAt });
});
