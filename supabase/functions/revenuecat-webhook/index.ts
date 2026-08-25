// @ts-nocheck deno-lint-ignore-file
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { createRevenueCatWebhookHandler, type HouseholdPremiumUpdate } from './handler.ts';

/**
 * Modell B: RevenueCat bindet den Kunden per `Purchases.logIn(session.user.id)`
 * an das Nutzerkonto. `app_user_id` ist deshalb die `profiles.id` (User UUID).
 *
 * Die Zuordnung zum Haushalt erfolgt primaer ueber das Subscriber Attribute
 * `subscriber_attributes.household_id.value`, oder sekundaer ueber die
 * `household_members`-Tabelle des Nutzers (mit Rueckfall auf direkte ID fuer
 * bestehende Events).
 *
 * RevenueCat sendet keinen Supabase-JWT. Die Function ist in config.toml mit
 * `verify_jwt = false` eingetragen und prueft stattdessen den im Dashboard
 * konfigurierten Authorization-Header in `handler.ts`.
 */
Deno.serve(
  createRevenueCatWebhookHandler({
    expectedSecret: Deno.env.get('REVENUECAT_WEBHOOK_SECRET'),
    updateHousehold: async (appUserId, update, subscriberAttributes) => {
      const adminClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );

      // 1. Haushalt-ID aus Subscriber Attributes ermitteln
      let targetHouseholdId = subscriberAttributes?.household_id?.value;

      // 2. Falls nicht im Attribut: Haushalt aus household_members abfragen
      if (!targetHouseholdId) {
        const { data: memberRows } = await adminClient
          .from('household_members')
          .select('household_id')
          .eq('user_id', appUserId)
          .order('joined_at', { ascending: false })
          .limit(1);

        if (memberRows && memberRows.length > 0) {
          targetHouseholdId = memberRows[0].household_id;
        }
      }

      // 3. Fallback: appUserId selbst ist bereits eine household_id (Abwaertskompatibilitaet)
      if (!targetHouseholdId) {
        targetHouseholdId = appUserId;
      }

      const { error, count } = await adminClient
        .from('households')
        .update(update satisfies HouseholdPremiumUpdate, { count: 'exact' })
        .eq('id', targetHouseholdId);

      return { error, count };
    },
  }),
);
