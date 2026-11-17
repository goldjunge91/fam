import { createClient } from 'jsr:@supabase/supabase-js@2';

import { requireEnv } from '../_shared/env.ts';
import { requireDefaultSupabaseKey } from '../_shared/supabase-keys.ts';
import { createDeleteAccountHandler } from './handler.ts';
import { createPostHogPersonDeleter, type PostHogDeletionCheckpointStore } from './posthog.ts';

const supabaseUrl = requireEnv('SUPABASE_URL');
const publishableKey = requireDefaultSupabaseKey('SUPABASE_PUBLISHABLE_KEYS');
const adminClient = createClient(supabaseUrl, requireDefaultSupabaseKey('SUPABASE_SECRET_KEYS'), {
  auth: { autoRefreshToken: false, persistSession: false },
});

const userClient = (authorization: string) =>
  createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

const checkpointColumns = [
  'user_id',
  'posthog_person_ids',
  'delete_requested_at',
  'delete_accepted_at',
  'delete_verified_at',
].join(',');

function checkpointForAdapter(value: unknown, expectedUserId: string): unknown {
  if (value === null || typeof value !== 'object') return value;
  const row = value as Record<string, unknown>;
  if (row.user_id !== expectedUserId) return {};
  return {
    personIds: row.posthog_person_ids,
    deleteRequestedAt: row.delete_requested_at,
    deleteAcceptedAt: row.delete_accepted_at,
    deleteVerifiedAt: row.delete_verified_at,
  };
}

const checkpointStore: PostHogDeletionCheckpointStore = {
  async read(userId) {
    try {
      const { data, error } = await adminClient
        .from('account_deletion_requests')
        .select(checkpointColumns)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        return {
          code: 'account_deletion_checkpoint_read',
          message: 'Account deletion checkpoint failed',
        };
      }
      return data === null ? null : checkpointForAdapter(data, userId);
    } catch {
      return {
        code: 'account_deletion_checkpoint_read',
        message: 'Account deletion checkpoint failed',
      };
    }
  },

  async upsert(userId, checkpoint) {
    try {
      const { error } = await adminClient
        .from('account_deletion_requests')
        .upsert({
          user_id: userId,
          posthog_person_ids: checkpoint.personIds,
          delete_requested_at: checkpoint.deleteRequestedAt,
          delete_accepted_at: checkpoint.deleteAcceptedAt,
          delete_verified_at: checkpoint.deleteVerifiedAt,
        }, { onConflict: 'user_id' });
      return error
        ? {
          code: 'account_deletion_checkpoint_write',
          message: 'Account deletion checkpoint failed',
        }
        : null;
    } catch {
      return {
        code: 'account_deletion_checkpoint_write',
        message: 'Account deletion checkpoint failed',
      };
    }
  },
};

const posthogApiKey = Deno.env.get('POSTHOG_PERSONAL_API_KEY')?.trim();
const posthogProjectId = Deno.env.get('POSTHOG_PROJECT_ID')?.trim();
const posthogHost = Deno.env.get('POSTHOG_HOST')?.trim();
if (!posthogApiKey || !posthogProjectId || !posthogHost) {
  console.error(JSON.stringify({
    event: 'delete_account_analytics_not_configured',
    provider: 'posthog',
    hasApiKey: Boolean(posthogApiKey),
    hasProjectId: Boolean(posthogProjectId),
    hasHost: Boolean(posthogHost),
  }));
}
const deletePostHogPerson = posthogApiKey && posthogProjectId && posthogHost
  ? createPostHogPersonDeleter(
    {
      apiKey: posthogApiKey,
      projectId: posthogProjectId,
      host: posthogHost,
    },
    fetch,
    checkpointStore,
  )
  : undefined;
const deleteAnalyticsData = deletePostHogPerson ?? (() =>
  Promise.resolve({
    code: 'posthog_delete_not_configured',
    message: 'PostHog deletion is not configured',
  }));

Deno.serve(
  createDeleteAccountHandler({
    getUserId: async (authorization) => {
      const { data, error } = await userClient(authorization).auth.getUser();
      return error ? null : (data.user?.id ?? null);
    },
    prepareDeletion: async (authorization) =>
      (await userClient(authorization).rpc('prepare_account_deletion')).error,
    deleteAnalyticsData,
    deleteUser: async (userId) => (await adminClient.auth.admin.deleteUser(userId)).error,
  }),
);
