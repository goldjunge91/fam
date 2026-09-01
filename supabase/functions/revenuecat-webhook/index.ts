// @ts-nocheck deno-lint-ignore-file
import { createClient } from "jsr:@supabase/supabase-js@2";

import {
  activeAiAssignmentHouseholdId,
  createRevenueCatWebhookHandler,
  type SubscriberAttribute,
} from "./handler.ts";

type AdminClient = ReturnType<typeof createClient>;

async function resolveMemberHousehold(
  adminClient: AdminClient,
  appUserId: string,
  subscriberAttributes?: Record<string, SubscriberAttribute> | null,
) {
  const requestedHouseholdId = subscriberAttributes?.household_id?.value;
  if (requestedHouseholdId) {
    const { data, error } = await adminClient
      .from("household_members")
      .select("household_id")
      .eq("household_id", requestedHouseholdId)
      .eq("user_id", appUserId)
      .maybeSingle();

    if (error) return { householdId: null, error };
    if (!data) {
      return {
        householdId: null,
        error: { message: "target_household_forbidden" },
      };
    }
    return { householdId: data.household_id, error: null };
  }

  const { data, error } = await adminClient
    .from("household_members")
    .select("household_id")
    .eq("user_id", appUserId)
    .order("joined_at", { ascending: false })
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
 * `verify_jwt = false` eingetragen und prueft stattdessen den im Dashboard
 * konfigurierten Authorization-Header in `handler.ts`.
 *
 * Idempotenz, Stale-Event-Guard und die kanonische Kaeufer-Zuordnung (Plus
 * und AI) laufen jeweils atomar in einer einzigen DB-Funktion
 * (assign_ai_household, deactivate_ai_household, apply_plus_household_event)
 * — ein Fehlschlag dort rollt auch den Dedup-Eintrag zurueck, statt ein Event
 * faelschlich als verarbeitet zu markieren.
 */
Deno.serve(
  createRevenueCatWebhookHandler({
    expectedSecret: Deno.env.get("REVENUECAT_WEBHOOK_SECRET"),
    applyEntitlementEvent: async (appUserId, change, subscriberAttributes) => {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      if (change.entitlementId === "AI") {
        if (!change.active) {
          const { data, error } = await adminClient.rpc(
            "deactivate_ai_household",
            {
              p_subscriber_user_id: appUserId,
              p_event_timestamp_ms: change.eventTimestampMs,
              p_event_id: change.eventId,
            },
          );
          return { error, count: error ? null : (data ? 1 : 0) };
        }

        // Aktive Renewals bleiben auf der kanonischen AI-Zuordnung. Nach einer
        // Expiration ist die Zeile nur noch ein Reihenfolge-/Cooldown-Tombstone;
        // eine spaetere Reaktivierung loest den dann aktiven Haushalt neu auf.
        const { data: assignment, error: assignmentError } = await adminClient
          .from("revenuecat_ai_assignments")
          .select("household_id, active")
          .eq("subscriber_user_id", appUserId)
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
            error: { message: "target_household_missing" },
            count: null,
          };
        }

        const { data, error } = await adminClient.rpc("assign_ai_household", {
          p_subscriber_user_id: appUserId,
          p_target_household_id: targetHouseholdId,
          p_entitlement_expires_at: change.expiresAt,
          p_event_timestamp_ms: change.eventTimestampMs,
          p_event_id: change.eventId,
        });
        return { error, count: error ? null : (data ? 1 : 0) };
      }

      // Plus bleibt am Kaufhaushalt: apply_plus_household_event ignoriert
      // householdId, sobald der Subscriber bereits kanonisch gebunden ist.
      const { data: plusAssignment, error: plusAssignmentError } =
        await adminClient
          .from("revenuecat_plus_assignments")
          .select("household_id")
          .eq("subscriber_user_id", appUserId)
          .maybeSingle();
      if (plusAssignmentError) {
        return { error: plusAssignmentError, count: null };
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
        return { error: { message: "target_household_missing" }, count: null };
      }

      const { data, error } = await adminClient.rpc(
        "apply_plus_household_event",
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
