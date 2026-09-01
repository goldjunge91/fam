// @ts-nocheck deno-lint-ignore-file
import { createClient } from "jsr:@supabase/supabase-js@2";

import {
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
 */
/**
 * Traegt (event_id, entitlement_id) idempotent in revenuecat_processed_events
 * ein. RevenueCat sendet ein Event bei ausbleibender 2xx-Antwort erneut zu;
 * ohne diese Sperre wuerde ein wiederholter Zustellversuch denselben Zustand
 * ein zweites Mal schreiben — bei AI sogar den Monatswechsel-Zaehler
 * verbrauchen, obwohl fachlich kein zweiter Wechsel stattfand. Gibt
 * `{ alreadyProcessed: true }` zurueck, wenn dieses Paar bereits existiert.
 */
async function markEventProcessed(
  adminClient: AdminClient,
  eventId: string,
  entitlementId: string,
): Promise<{ alreadyProcessed: boolean; error: { message: string } | null }> {
  const { data, error } = await adminClient
    .from("revenuecat_processed_events")
    .upsert(
      { event_id: eventId, entitlement_id: entitlementId },
      { onConflict: "event_id,entitlement_id", ignoreDuplicates: true },
    )
    .select("event_id");

  if (error) return { alreadyProcessed: false, error };
  return { alreadyProcessed: (data?.length ?? 0) === 0, error: null };
}

Deno.serve(
  createRevenueCatWebhookHandler({
    expectedSecret: Deno.env.get("REVENUECAT_WEBHOOK_SECRET"),
    applyEntitlementEvent: async (appUserId, change, subscriberAttributes) => {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const dedup = await markEventProcessed(
        adminClient,
        change.eventId,
        change.entitlementId,
      );
      if (dedup.error) return { error: dedup.error, count: null };
      // Bereits verarbeitetes Event/Entitlement-Paar (Retry-Zustellung):
      // erfolgreich, aber ohne erneute Anwendung.
      if (dedup.alreadyProcessed) return { error: null, count: 0 };

      if (change.entitlementId === "AI") {
        if (!change.active) {
          const { error } = await adminClient.rpc("deactivate_ai_household", {
            p_subscriber_user_id: appUserId,
            p_event_timestamp_ms: change.eventTimestampMs,
          });
          return { error, count: error ? null : 1 };
        }

        // Renewals bleiben auf der kanonischen AI-Zuordnung. Nur die erste
        // Aktivierung verwendet den beim Kauf gemeldeten aktiven Haushalt.
        const { data: assignment, error: assignmentError } = await adminClient
          .from("revenuecat_ai_assignments")
          .select("household_id")
          .eq("subscriber_user_id", appUserId)
          .maybeSingle();
        if (assignmentError) return { error: assignmentError, count: null };

        let targetHouseholdId = assignment?.household_id;
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

        const { error } = await adminClient.rpc("assign_ai_household", {
          p_subscriber_user_id: appUserId,
          p_target_household_id: targetHouseholdId,
          p_entitlement_expires_at: change.expiresAt,
          p_event_timestamp_ms: change.eventTimestampMs,
        });
        return { error, count: error ? null : 1 };
      }

      const resolved = await resolveMemberHousehold(
        adminClient,
        appUserId,
        subscriberAttributes,
      );
      if (resolved.error) return { error: resolved.error, count: null };
      if (!resolved.householdId) {
        return { error: { message: "target_household_missing" }, count: null };
      }

      // Stale-Event-Guard: Ein verspaetet zugestelltes aelteres Plus-Event
      // (Retry, Out-of-Order-Zustellung) darf einen bereits neueren Stand
      // nicht ueberschreiben. `or()` erlaubt den Schreibzugriff nur, wenn noch
      // kein Event angewendet wurde oder das gespeicherte aelter/gleich ist.
      const { error, count } = await adminClient
        .from("households")
        .update(
          {
            plus_active: change.active,
            plus_expires_at: change.expiresAt,
            plus_updated_at: change.processedAt,
            plus_last_event_timestamp_ms: change.eventTimestampMs,
          },
          { count: "exact" },
        )
        .eq("id", resolved.householdId)
        .or(
          `plus_last_event_timestamp_ms.is.null,plus_last_event_timestamp_ms.lte.${change.eventTimestampMs}`,
        );

      return { error, count };
    },
  }),
);
