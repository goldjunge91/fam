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
          const { error, count } = await adminClient
            .from("households")
            .update(
              {
                ai_active: false,
                ai_expires_at: null,
                ai_updated_at: change.processedAt,
                ai_subscriber_id: null,
              },
              { count: "exact" },
            )
            .eq("ai_subscriber_id", appUserId);
          return { error, count };
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

      const { error, count } = await adminClient
        .from("households")
        .update(
          {
            plus_active: change.active,
            plus_expires_at: change.expiresAt,
            plus_updated_at: change.processedAt,
          },
          { count: "exact" },
        )
        .eq("id", resolved.householdId);

      return { error, count };
    },
  }),
);
