import { useQuery } from '@tanstack/react-query';

import { isOrphanedProfileError } from '@/features/profile/orphaned-profile-error';
import type { Database } from '@/lib/database.types';
import {
  type ProfileUpdateInput,
  profileUpdateSchema,
  toProfileDatabaseUpdate,
} from '@/lib/db/zod/profile.zod';
import { getSupabase } from '@/lib/supabase';

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await getSupabase()
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(userId),
    retry: (failureCount, error) => !isOrphanedProfileError(error) && failureCount < 2,
  });
}

export async function updateProfile(userId: string, input: ProfileUpdateInput) {
  const payload: Database['public']['Tables']['profiles']['Update'] = toProfileDatabaseUpdate(
    profileUpdateSchema.parse(input),
  );

  const { error } = await getSupabase().from('profiles').update(payload).eq('id', userId);

  return { error };
}
