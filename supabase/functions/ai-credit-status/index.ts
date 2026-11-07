import { createClient } from 'jsr:@supabase/supabase-js@2';

import { requireEnv } from '../_shared/env.ts';
import { withRequestId } from '../_shared/http.ts';
import { requireDefaultSupabaseKey } from '../_shared/supabase-keys.ts';
import { AI_CREDIT_LIMIT, createAiCreditStatusHandler } from './handler.ts';

const supabaseUrl = requireEnv('SUPABASE_URL');
const publishableKey = requireDefaultSupabaseKey('SUPABASE_PUBLISHABLE_KEYS');
const secretKey = requireDefaultSupabaseKey('SUPABASE_SECRET_KEYS');
const adminClient = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function userClient(authorization: string, requestId: string) {
  return createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization, 'X-Request-Id': requestId } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

Deno.serve(
  withRequestId(
    'ai-credit-status',
    createAiCreditStatusHandler({
      authenticate: async (authorization, requestId) => {
        const { data, error } = await userClient(authorization, requestId).auth.getUser();
        return error || !data.user
          ? { ok: false as const, status: 401 as const, error: 'unauthorized' as const }
          : { ok: true as const, userId: data.user.id };
      },
      listHouseholdIds: async (userId, authorization, requestId) => {
        const { data, error } = await userClient(authorization, requestId)
          .from('household_members')
          .select('household_id')
          .eq('user_id', userId);
        if (error) return { ok: false as const };

        const householdIds = Array.from(
          new Set(
            (data ?? [])
              .map((row) => row.household_id)
              .filter((householdId): householdId is string => typeof householdId === 'string'),
          ),
        );
        return { ok: true as const, householdIds };
      },
      readStatus: async (householdId, _requestId) => {
        const { data, error } = await adminClient.rpc('get_ai_credit_status', {
          p_household_id: householdId,
          p_monthly_limit: AI_CREDIT_LIMIT,
        });
        if (error) return { ok: false as const };
        const row = Array.isArray(data) ? data[0] : data;
        return row === undefined || row === null
          ? { ok: false as const }
          : { ok: true as const, row };
      },
    }),
  ),
);
