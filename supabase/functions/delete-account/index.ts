import { createClient } from 'jsr:@supabase/supabase-js@2';

import { requireEnv } from '../_shared/env.ts';
import { withRequestId } from '../_shared/http.ts';
import { requireDefaultSupabaseKey } from '../_shared/supabase-keys.ts';
import { createDeleteAccountHandler } from './handler.ts';

const supabaseUrl = requireEnv('SUPABASE_URL');
const publishableKey = requireDefaultSupabaseKey('SUPABASE_PUBLISHABLE_KEYS');
const secretKey = requireDefaultSupabaseKey('SUPABASE_SECRET_KEYS');
const adminClient = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const userClient = (authorization: string) =>
  createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

Deno.serve(
  withRequestId(
    'delete-account',
    createDeleteAccountHandler({
      getUserId: async (authorization) => {
        const { data, error } = await userClient(authorization).auth.getUser();
        return error ? null : (data.user?.id ?? null);
      },
      prepareDeletion: async (authorization) =>
        (await userClient(authorization).rpc('prepare_account_deletion')).error,
      deleteUser: async (userId) => (await adminClient.auth.admin.deleteUser(userId)).error,
    }),
  ),
);
