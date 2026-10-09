import { createClient } from 'jsr:@supabase/supabase-js@2';

import { requireEnv } from '../_shared/env.ts';
import { createDeleteAccountHandler } from './handler.ts';

const supabaseUrl = requireEnv('SUPABASE_URL');
const anonKey = requireEnv('SUPABASE_ANON_KEY');
const adminClient = createClient(supabaseUrl, requireEnv('SUPABASE_SERVICE_ROLE_KEY'));

const userClient = (authorization: string) =>
  createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });

Deno.serve(
  createDeleteAccountHandler({
    getUserId: async (authorization) => {
      const { data, error } = await userClient(authorization).auth.getUser();
      return error ? null : (data.user?.id ?? null);
    },
    prepareDeletion: async (authorization) =>
      (await userClient(authorization).rpc('prepare_account_deletion')).error,
    deleteUser: async (userId) => (await adminClient.auth.admin.deleteUser(userId)).error,
  }),
);
