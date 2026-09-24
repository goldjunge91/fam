import { useQuery } from '@tanstack/react-query';
import { getSupabase } from '@/lib/backend/supabase/remote-client';

export function profileLatestWeightQueryKey(userId: string | undefined) {
  return ['profile', 'latest-weight', userId] as const;
}

export async function fetchLatestProfileWeight(userId: string) {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('weight_kg')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.weight_kg ?? null;
}

export function useLatestProfileWeight(userId: string | undefined) {
  return useQuery({
    queryKey: profileLatestWeightQueryKey(userId),
    queryFn: () => fetchLatestProfileWeight(userId as string),
    enabled: Boolean(userId),
  });
}
