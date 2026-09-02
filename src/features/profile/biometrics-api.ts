import { useQuery } from '@tanstack/react-query';
import { getSupabase } from '@/lib/supabase';

export function profileLatestWeightQueryKey(userId: string | undefined) {
  return ['profile', 'latest-weight', userId] as const;
}

export async function fetchLatestProfileWeight(userId: string) {
  const { data, error } = await getSupabase()
    .from('weight_entries')
    .select('*')
    .eq('user_id', userId)
    .is('child_profile_id', null)
    .is('deleted_at', null)
    .order('measured_on', { ascending: false })
    .order('measured_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export function useLatestProfileWeight(userId: string | undefined) {
  return useQuery({
    queryKey: profileLatestWeightQueryKey(userId),
    queryFn: () => fetchLatestProfileWeight(userId as string),
    enabled: Boolean(userId),
  });
}
