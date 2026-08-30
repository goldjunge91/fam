import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MedicationUnit } from '@/features/glp1/domain/medication-options';
import type { Database } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

export type InjectionPlanRow = Database['public']['Tables']['injection_plans']['Row'];

export type InjectionPlanInput = {
  userId: string;
  medicationName: string;
  dose: number;
  unit: MedicationUnit;
  cadenceDays: number;
  anchorAt: string;
  reminderEnabled: boolean;
};

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
      const { data, error } = await getSupabase()
        .from('injection_plans')
        .insert({
          user_id: input.userId,
          medication_name: input.medicationName.trim(),
          dose: input.dose,
          unit: input.unit,
          cadence_days: input.cadenceDays,
          anchor_at: input.anchorAt,
          reminder_enabled: input.reminderEnabled,
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
      const { data, error } = await getSupabase()
        .from('injection_plans')
        .update({
          medication_name: input.medicationName.trim(),
          dose: input.dose,
          unit: input.unit,
          cadence_days: input.cadenceDays,
          anchor_at: input.anchorAt,
          reminder_enabled: input.reminderEnabled,
        })
        .eq('id', input.id)
        .eq('user_id', input.userId)
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
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
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
