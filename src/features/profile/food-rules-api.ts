import { useQuery } from '@tanstack/react-query';

import {
  fromStoredProfileFoodRules,
  type ProfileFoodRules,
  toStoredProfileFoodRules,
} from '@/features/profile/domain/food-rules';
import type { Database } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

export function profileFoodRulesQueryKey(userId: string | undefined) {
  return ['profile-food-rules', userId] as const;
}

export async function fetchProfileFoodRules(userId: string): Promise<ProfileFoodRules> {
  const { data, error } = await getSupabase()
    .from('profile_food_rules')
    .select(
      'allergy_codes, custom_allergies, intolerance_codes, custom_intolerances, disliked_foods',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return fromStoredProfileFoodRules(data);
}

export function useProfileFoodRules(userId: string | undefined) {
  return useQuery({
    queryKey: profileFoodRulesQueryKey(userId),
    queryFn: () => fetchProfileFoodRules(userId as string),
    enabled: Boolean(userId),
  });
}

export async function saveProfileFoodRules(userId: string, rules: ProfileFoodRules) {
  const stored = toStoredProfileFoodRules(rules);
  const payload: Database['public']['Tables']['profile_food_rules']['Insert'] = {
    user_id: userId,
    ...stored,
  };

  const { error } = await getSupabase()
    .from('profile_food_rules')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) throw new Error(error.message);
}
