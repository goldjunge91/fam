import * as Linking from 'expo-linking';
import { getSupabase, type TypedSupabaseClient } from '@/lib/backend/supabase/remote-client';
import { env } from '@/lib/config/env';

export async function signUp(email: string, password: string) {
  const { data, error } = await getSupabase().auth.signUp({ email, password });
  return { data, error };
}

export async function confirmSignUpWithCode(email: string, token: string) {
  const { data, error } = await getSupabase().auth.verifyOtp({
    email,
    token,
    type: 'signup',
  });
  return { data, error };
}

export async function resendConfirmationEmail(email: string) {
  const { error } = await getSupabase().auth.resend({ type: 'signup', email });
  return { error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut();
  return { error };
}

export async function requestPasswordReset(email: string) {
  const redirectTo = env.passwordRecoveryUrl ?? Linking.createURL('/password-recovery');
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo });
  return { error };
}

export async function verifyPasswordRecoveryCode(
  client: TypedSupabaseClient,
  email: string,
  token: string,
) {
  const { data, error } = await client.auth.verifyOtp({ email, token, type: 'recovery' });
  return { data, error };
}

export async function updatePasswordWithRecoveryClient(
  client: TypedSupabaseClient,
  password: string,
) {
  const { error } = await client.auth.updateUser({ password });
  return { error };
}

export async function getPrimarySessionUserId(): Promise<string | null> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  return data.session?.user.id ?? null;
}

export async function transferPasswordRecoverySession(
  recoveryClient: TypedSupabaseClient,
  initialPrimaryUserId: string | null,
): Promise<
  'transferred' | 'primary-session-preserved' | 'sign-in-required' | 'transfer-uncertain'
> {
  const primary = getSupabase();
  const { data: primaryData, error: primaryError } = await primary.auth.getSession();
  if (primaryError) return 'sign-in-required';

  // A session present at flow start or now belongs to the app. Do not replace it.
  if (primaryData.session) return 'primary-session-preserved';
  if (initialPrimaryUserId) return 'sign-in-required';

  const { data: recoveryData, error: recoveryError } = await recoveryClient.auth.getSession();
  const recoverySession = recoveryData.session;
  if (recoveryError || !recoverySession) return 'sign-in-required';

  try {
    const { data, error } = await primary.auth.setSession({
      access_token: recoverySession.access_token,
      refresh_token: recoverySession.refresh_token,
    });
    if (!error && data.session?.user.id === recoverySession.user.id) return 'transferred';
  } catch {
    // Session state is checked below because the client may have persisted it first.
  }

  // A separate sign-in may have completed while transfer was in flight. Keep it.
  try {
    const { data: latestPrimary, error: latestError } = await primary.auth.getSession();
    if (latestError) return 'transfer-uncertain';
    if (latestPrimary.session?.user.id === recoverySession.user.id) return 'transferred';
    return latestPrimary.session ? 'primary-session-preserved' : 'sign-in-required';
  } catch {
    return 'transfer-uncertain';
  }
}

export async function discardPasswordRecoverySession(client: TypedSupabaseClient) {
  const { error } = await client.auth.signOut({ scope: 'local' });
  return { error };
}

export async function updatePassword(password: string) {
  const { error } = await getSupabase().auth.updateUser({ password });
  return { error };
}
