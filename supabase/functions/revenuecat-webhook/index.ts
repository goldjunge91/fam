import { createClient } from 'jsr:@supabase/supabase-js@2';
import { requireSupabaseSecretKey } from '../_shared/env.ts';
import { isRevenueCatSandboxAllowed } from '../_shared/revenuecat-environment.ts';

import {
  activeAiAssignmentHouseholdId,
  createRevenueCatWebhookHandler,
  type LocalProfileMappings,
  type SubscriberAttribute,
} from './handler.ts';
import { createRevenueCatSubscriberStatusReader } from './subscriber-status.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const allowRevenueCatSandbox = isRevenueCatSandboxAllowed(supabaseUrl);

function createAdminClient() {
  return createClient(
    supabaseUrl,
    requireSupabaseSecretKey(),
  );
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function resolveLocalProfiles(
  adminClient: AdminClient,
  subscriberIds: string[],
): Promise<LocalProfileMappings> {
  const candidates = Array.from(new Set(subscriberIds));
  if (candidates.length === 0) return new Map();

  const { data, error } = await adminClient
    .schema('public')
    .from('profiles')
    .select('id')
    .in('id', candidates);
  if (error) throw error;

  const returnedProfileIds = new Map<string, string>();
  for (const row of data ?? []) {
    if (typeof row.id === 'string') {
      returnedProfileIds.set(row.id.toLowerCase(), row.id);
    }
  }

  return new Map(
    candidates.flatMap((subscriberId) => {
      const profileId = returnedProfileIds.get(subscriberId.toLowerCase());
      return profileId ? [[subscriberId, profileId] as const] : [];
    }),
  );
}

async function resolveMemberHousehold(
  adminClient: AdminClient,
  appUserId: string,
  subscriberAttributes?: Record<string, SubscriberAttribute> | null,
) {
  const requestedHouseholdId = subscriberAttributes?.household_id?.value;
  if (requestedHouseholdId) {
    const { data, error } = await adminClient
      .from('household_members')
      .select('household_id')
      .eq('household_id', requestedHouseholdId)
      .eq('user_id', appUserId)
      .maybeSingle();

    if (error) return { householdId: null, error };
    if (!data) {
      return {
        householdId: null,
        error: { message: 'target_household_forbidden' },
      };
    }
    return { householdId: data.household_id, error: null };
  }

  const { data, error } = await adminClient
    .from('household_members')
    .select('household_id')
    .eq('user_id', appUserId)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return { householdId: data?.household_id ?? null, error };
}

/**
 * Modell B: RevenueCat bindet den Kunden per `Purchases.logIn(session.user.id)`
 * an das Nutzerkonto. `app_user_id` ist deshalb die `profiles.id` (User UUID).
 *
 * Die Zuordnung zum Haushalt erfolgt primaer ueber das Subscriber Attribute
 * `subscriber_attributes.household_id.value`, oder sekundaer ueber die
 * `household_members`-Tabelle des Nutzers. Ein vom Client gemeldeter Haushalt
 * wird vor jedem Schreibzugriff gegen die Mitgliedschaft geprueft.
 *
 * RevenueCat sendet keinen Supabase-JWT. Die Function ist in config.toml mit
 * `verify_jwt = false` eingetragen und prueft stattdessen die HMAC-Signatur
 * des unveraenderten Request-Bodys in `handler.ts`.
 *
 * Idempotenz, Stale-Event-Guard und die verbindliche Käufer-Zuordnung fuer Plus
 * und AI laufen jeweils atomar in einer Datenbankfunktion
 * (assign_ai_household, deactivate_ai_household, apply_plus_household_event).
 * Bei einem Fehler wird auch der Dedup-Eintrag zurueckgerollt, damit das Event
 * nicht faelschlich als verarbeitet gilt.
 */
Deno.serve(
  createRevenueCatWebhookHandler({
    expectedSecret: Deno.env.get('REVENUECAT_WEBHOOK_SECRET'),
    readSubscriberStatus: createRevenueCatSubscriberStatusReader(
      Deno.env.get('REVENUECAT_SECRET_API_KEY'),
      fetch,
      { allowSandbox: allowRevenueCatSandbox },
    ),
    allowSandbox: allowRevenueCatSandbox,
    resolveLocalProfiles: (subscriberIds) =>
      resolveLocalProfiles(createAdminClient(), subscriberIds),
    applyEntitlementEvent: async (appUserId, change, subscriberAttributes) => {
      const adminClient = createAdminClient();

      if (change.entitlementId === 'AI') {
        if (!change.active) {
          const { data, error } = await adminClient.rpc(
            'deactivate_ai_household',
            {
              p_subscriber_user_id: appUserId,
              p_event_timestamp_ms: change.eventTimestampMs,
              p_event_id: change.eventId,
            },
          );
          return { error, count: error ? null : (data ? 1 : 0) };
        }

        // Aktive Renewals behalten die bestehende AI-Haushaltszuordnung. Nach
        // einer Expiration dient die Zeile nur noch als Reihenfolge- und
        // Cooldown-Marker. Bei spaeterer Reaktivierung wird der aktuelle
        // Haushalt neu aufgeloest.
        const { data: assignment, error: assignmentError } = await adminClient
          .from('revenuecat_ai_assignments')
          .select('household_id, active')
          .eq('subscriber_user_id', appUserId)
          .maybeSingle();
        if (assignmentError) return { error: assignmentError, count: null };

        let targetHouseholdId = activeAiAssignmentHouseholdId(assignment);
        if (!targetHouseholdId) {
          const resolved = await resolveMemberHousehold(
            adminClient,
            appUserId,
            subscriberAttributes,
          );
          if (resolved.error) return { error: resolved.error, count: null };
          targetHouseholdId = resolved.householdId;
        }

        if (!targetHouseholdId) {
          return {
            error: { message: 'target_household_missing' },
            count: null,
          };
        }

        const { data, error } = await adminClient.rpc('assign_ai_household', {
          p_subscriber_user_id: appUserId,
          p_target_household_id: targetHouseholdId,
          p_entitlement_expires_at: change.expiresAt,
          p_event_timestamp_ms: change.eventTimestampMs,
          p_event_id: change.eventId,
        });
        return { error, count: error ? null : (data ? 1 : 0) };
      }

      // Plus bleibt an den Kaufhaushalt gebunden. apply_plus_household_event
      // ignoriert householdId, wenn der Subscriber bereits einem Haushalt
      // zugeordnet ist.
      const { data: plusAssignment, error: plusAssignmentError } = await adminClient
        .from('revenuecat_plus_assignments')
        .select('household_id')
        .eq('subscriber_user_id', appUserId)
        .maybeSingle();
      if (plusAssignmentError) {
        return { error: plusAssignmentError, count: null };
      }

      if (!change.active && !plusAssignment?.household_id) {
        return { error: null, count: 0 };
      }

      let householdId = plusAssignment?.household_id;
      if (!householdId) {
        const resolved = await resolveMemberHousehold(
          adminClient,
          appUserId,
          subscriberAttributes,
        );
        if (resolved.error) return { error: resolved.error, count: null };
        householdId = resolved.householdId;
      }

      if (!householdId) {
        return { error: { message: 'target_household_missing' }, count: null };
      }

      const { data, error } = await adminClient.rpc(
        'apply_plus_household_event',
        {
          p_subscriber_user_id: appUserId,
          p_household_id: householdId,
          p_active: change.active,
          p_expires_at: change.expiresAt,
          p_event_timestamp_ms: change.eventTimestampMs,
          p_event_id: change.eventId,
        },
      );
      return { error, count: error ? null : (data ? 1 : 0) };
    },
  }),
);
