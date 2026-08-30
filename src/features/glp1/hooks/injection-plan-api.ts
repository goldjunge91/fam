import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type DeleteInjectionPlanInput,
  deleteInjectionPlanMutationSchema,
  type InjectionPlanInput,
  injectionPlanMutationSchema,
  updateInjectionPlanMutationSchema,
} from '@/features/glp1/domain/mutation-schemas';
import type { Database } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

export type InjectionPlanRow = Database['public']['Tables']['injection_plans']['Row'];

export type { DeleteInjectionPlanInput, InjectionPlanInput };

export function injectionPlanQueryKey(userId: string | undefined) {
  return ['glp1', 'injection-plan', userId] as const;
}

export function useInjectionPlan(userId: string | undefined) {
  return useQuery({
    queryKey: injectionPlanQueryKey(userId),
    queryFn: async (): Promise<InjectionPlanRow | null> => {
      const { data, error } = await getSupabase()
        .from('injection_plans')
        .select('*')
        .eq('user_id', userId as string)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!userId,
  });
}

export function useCreateInjectionPlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InjectionPlanInput) => {
      const validated = injectionPlanMutationSchema.parse(input);
      const { data, error } = await getSupabase()
        .from('injection_plans')
        .insert({
          user_id: validated.userId,
          medication_name: validated.medicationName,
          dose: validated.dose,
          unit: validated.unit,
          cadence_days: validated.cadenceDays,
          anchor_at: validated.anchorAt,
          reminder_enabled: validated.reminderEnabled,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: injectionPlanQueryKey(variables.userId) });
    },
  });
}

export function useUpdateInjectionPlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InjectionPlanInput & { id: string }) => {
      const validated = updateInjectionPlanMutationSchema.parse(input);
      const { data, error } = await getSupabase()
        .from('injection_plans')
        .update({
          medication_name: validated.medicationName,
          dose: validated.dose,
          unit: validated.unit,
          cadence_days: validated.cadenceDays,
          anchor_at: validated.anchorAt,
          reminder_enabled: validated.reminderEnabled,
        })
        .eq('id', validated.id)
        .eq('user_id', validated.userId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: injectionPlanQueryKey(variables.userId) });
    },
  });
}

export function useDeleteInjectionPlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeleteInjectionPlanInput) => {
      const { id, userId } = deleteInjectionPlanMutationSchema.parse(input);
      const { error } = await getSupabase()
        .from('injection_plans')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw new Error(error.message);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: injectionPlanQueryKey(variables.userId) });
    },
  });
}
