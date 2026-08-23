// @ts-nocheck deno-lint-ignore-file
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { createRevenueCatWebhookHandler, type HouseholdPremiumUpdate } from './handler.ts';

// `app_user_id` ist die Haushalts-ID; der Webhook authentifiziert sich per Shared Secret.
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
