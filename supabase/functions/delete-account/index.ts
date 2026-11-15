import { createClient } from 'jsr:@supabase/supabase-js@2';

import { requireEnv, requireSupabaseSecretKey } from '../_shared/env.ts';
import { createPostHogPersonDeleter } from './posthog.ts';
import { createDeleteAccountHandler } from './handler.ts';

const supabaseUrl = requireEnv('SUPABASE_URL');
const anonKey = requireEnv('SUPABASE_ANON_KEY');
const adminClient = createClient(supabaseUrl, requireSupabaseSecretKey());

const userClient = (authorization: string) =>
  createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });

const posthogApiKey = Deno.env.get('POSTHOG_PERSONAL_API_KEY');
const posthogProjectId = Deno.env.get('POSTHOG_PROJECT_ID');
const posthogHost = Deno.env.get('POSTHOG_HOST');
const deletePostHogPerson = posthogApiKey && posthogProjectId && posthogHost
  ? createPostHogPersonDeleter({
    apiKey: posthogApiKey,
    projectId: posthogProjectId,
    host: posthogHost,
  })
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
