import { getSupabase } from '@/lib/supabase';

export async function markOnboardingCompleted(userId: string) {
  const { error } = await getSupabase()
    .from('profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', userId);

  return { error };
}
