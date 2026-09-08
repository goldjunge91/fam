// @ts-nocheck deno-lint-ignore-file
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createDeleteAccountHandler } from './handler.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey =
  Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
if (!anonKey) {
  throw new Error('SUPABASE_ANON_KEY oder SUPABASE_PUBLISHABLE_KEY erforderlich.');
}
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY erforderlich.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey);

const handler = createDeleteAccountHandler({
  authenticate: async (authHeader) => {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader! } },
    });
    const {
      data: { user },
      error,
    } = await userClient.auth.getUser();
    if (error || !user) {
      return { ok: false as const, status: 401 as const, error: 'unauthorized' };
    }
    return { ok: true as const, user: { id: user.id } };
  },

  checkRequestLimit: async (userId) => {
    const { data, error } = await adminClient.rpc('consume_request_limit', {
      p_user_id: userId,
      p_scope: 'delete-account',
      p_limit: 5,
      p_window_seconds: 60,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.allowed !== 'boolean') {
      throw new Error('invalid rate limit response');
    }
    return {
      allowed: row.allowed,
      retryAfter: Number.isFinite(row.retry_after) ? Math.max(1, Math.ceil(Number(row.retry_after))) : null,
    };
  },

  prepareAccountDeletion: async (_userId, authHeader) => {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { error } = await userClient.rpc('prepare_account_deletion');
    return { error };
  },

  deleteUser: async (userId) => {
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    return { error };
  },
});

Deno.serve(handler);
