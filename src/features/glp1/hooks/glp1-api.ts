import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

export type MedicationLogRow = Database['public']['Tables']['medication_logs']['Row'];
export type SymptomLogRow = Database['public']['Tables']['symptom_logs']['Row'];

export function medicationLogsQueryKey(userId: string | undefined, childProfileId?: string | null) {
  return ['glp1', 'medications', userId, childProfileId ?? null] as const;
}

export function symptomLogsQueryKey(userId: string | undefined, childProfileId?: string | null) {
  return ['glp1', 'symptoms', userId, childProfileId ?? null] as const;
}

export function useMedicationLogs(userId: string | undefined, childProfileId?: string | null) {
  return useQuery({
    queryKey: medicationLogsQueryKey(userId, childProfileId),
    queryFn: async (): Promise<MedicationLogRow[]> => {
      let query = getSupabase()
        .from('medication_logs')
        .select('*')
        .eq('user_id', userId as string)
        .is('deleted_at', null)
        .order('administered_at', { ascending: false });

      if (childProfileId) {
        query = query.eq('child_profile_id', childProfileId);
      } else {
        query = query.is('child_profile_id', null);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!userId,
  });
}

export type CreateMedicationLogInput = {
  userId: string;
  childProfileId?: string | null;
  medicationName: string;
  dose?: number | null;
  unit?: string;
  injectionSite?: string | null;
  administeredAt?: string;
  notes?: string | null;
};

export function useAddMedicationLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMedicationLogInput) => {
      const { data, error } = await getSupabase()
        .from('medication_logs')
        .insert({
          user_id: input.userId,
          child_profile_id: input.childProfileId ?? null,
          medication_name: input.medicationName.trim(),
          dose: input.dose ?? null,
          unit: input.unit ?? 'mg',
          injection_site: input.injectionSite ?? null,
          administered_at: input.administeredAt ?? new Date().toISOString(),
          notes: input.notes?.trim() || null,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: medicationLogsQueryKey(variables.userId, variables.childProfileId),
      });
    },
  });
}

export type UpdateMedicationLogInput = CreateMedicationLogInput & { id: string };

export function useUpdateMedicationLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateMedicationLogInput) => {
      const { data, error } = await getSupabase()
        .from('medication_logs')
        .update({
          medication_name: input.medicationName.trim(),
          dose: input.dose ?? null,
          unit: input.unit ?? 'mg',
          injection_site: input.injectionSite ?? null,
          administered_at: input.administeredAt ?? new Date().toISOString(),
          notes: input.notes?.trim() || null,
        })
        .eq('id', input.id)
        .eq('user_id', input.userId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: medicationLogsQueryKey(variables.userId, variables.childProfileId),
      });
    },
  });
}

export function useDeleteMedicationLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      userId,
    }: {
      id: string;
      userId: string;
      childProfileId?: string | null;
    }) => {
      const { error } = await getSupabase()
        .from('medication_logs')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw new Error(error.message);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: medicationLogsQueryKey(variables.userId, variables.childProfileId),
      });
    },
  });
}

export function useRestoreMedicationLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      userId,
    }: {
      id: string;
      userId: string;
      childProfileId?: string | null;
    }) => {
      const { error } = await getSupabase()
        .from('medication_logs')
        .update({ deleted_at: null })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw new Error(error.message);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: medicationLogsQueryKey(variables.userId, variables.childProfileId),
      });
    },
  });
}

export function useSymptomLogs(userId: string | undefined, childProfileId?: string | null) {
  return useQuery({
    queryKey: symptomLogsQueryKey(userId, childProfileId),
    queryFn: async (): Promise<SymptomLogRow[]> => {
      let query = getSupabase()
        .from('symptom_logs')
        .select('*')
        .eq('user_id', userId as string)
        .is('deleted_at', null)
        .order('logged_at', { ascending: false });

      if (childProfileId) {
        query = query.eq('child_profile_id', childProfileId);
      } else {
        query = query.is('child_profile_id', null);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!userId,
  });
}

export type CreateSymptomLogInput = {
  userId: string;
  childProfileId?: string | null;
  loggedAt?: string;
  appetiteLevel?: number | null;
  satietyLevel?: number | null;
  nauseaLevel?: number | null;
  sideEffects?: string[];
  notes?: string | null;
};

export function useAddSymptomLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSymptomLogInput) => {
      const { data, error } = await getSupabase()
        .from('symptom_logs')
        .insert({
          user_id: input.userId,
          child_profile_id: input.childProfileId ?? null,
          logged_at: input.loggedAt ?? new Date().toISOString(),
          appetite_level: input.appetiteLevel ?? null,
          satiety_level: input.satietyLevel ?? null,
          nausea_level: input.nauseaLevel ?? null,
          side_effects: input.sideEffects ?? [],
          notes: input.notes?.trim() || null,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: symptomLogsQueryKey(variables.userId, variables.childProfileId),
      });
    },
  });
}

export type UpdateSymptomLogInput = CreateSymptomLogInput & { id: string };

export function useUpdateSymptomLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateSymptomLogInput) => {
      const { data, error } = await getSupabase()
        .from('symptom_logs')
        .update({
          logged_at: input.loggedAt ?? new Date().toISOString(),
          appetite_level: input.appetiteLevel ?? null,
          satiety_level: input.satietyLevel ?? null,
          nausea_level: input.nauseaLevel ?? null,
          side_effects: input.sideEffects ?? [],
          notes: input.notes?.trim() || null,
        })
        .eq('id', input.id)
        .eq('user_id', input.userId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: symptomLogsQueryKey(variables.userId, variables.childProfileId),
      });
    },
  });
}

type SymptomLogMutationScope = {
  id: string;
  userId: string;
  childProfileId?: string | null;
};

export function useDeleteSymptomLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, userId }: SymptomLogMutationScope) => {
      const { error } = await getSupabase()
        .from('symptom_logs')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw new Error(error.message);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: symptomLogsQueryKey(variables.userId, variables.childProfileId),
      });
    },
  });
}

export function useRestoreSymptomLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, userId }: SymptomLogMutationScope) => {
      const { error } = await getSupabase()
        .from('symptom_logs')
        .update({ deleted_at: null })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw new Error(error.message);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: symptomLogsQueryKey(variables.userId, variables.childProfileId),
      });
    },
  });
}
