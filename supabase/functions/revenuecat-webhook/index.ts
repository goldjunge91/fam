// @ts-nocheck deno-lint-ignore-file
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { createRevenueCatWebhookHandler, type HouseholdPremiumUpdate } from './handler.ts';

/**
 * RevenueCat bindet den Kunden per `Purchases.logIn(activeHouseholdId)` an
 * den Haushalt. `app_user_id` ist deshalb direkt die `households.id`.
 *
 * RevenueCat sendet keinen Supabase-JWT. Die Function ist in config.toml mit
 * `verify_jwt = false` eingetragen und prueft stattdessen den im Dashboard
 * konfigurierten Authorization-Header in `handler.ts`.
 */
Deno.serve(
  createRevenueCatWebhookHandler({
    expectedSecret: Deno.env.get('REVENUECAT_WEBHOOK_SECRET'),
    updateHousehold: async (householdId, update) => {
      const adminClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );

      const { error, count } = await adminClient
        .from('households')
        .update(update satisfies HouseholdPremiumUpdate, { count: 'exact' })
        .eq('id', householdId);

      return { error, count };
    },
  }),
);
