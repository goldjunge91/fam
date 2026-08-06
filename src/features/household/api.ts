import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSupabase } from '@/lib/supabase';

/**
 * Laedt alle Haushalte, in denen der aktuell angemeldete Nutzer Mitglied ist.
 * Dank RLS liefert dieser einfache Select genau die richtige Teilmenge.
 */
export function useHouseholds() {
  return useQuery({
    queryKey: ['households'],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('households')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}

export function useCreateHouseholdMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (householdName: string) => {
      const { data, error } = await getSupabase().rpc('create_household', {
        household_name: householdName,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['households'] });
    },
  });
}

export function useHouseholdMembers(householdId: string) {
  return useQuery({
    queryKey: ['households', householdId, 'members'],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('household_members')
        .select('*, profiles:user_id(*)')
        .eq('household_id', householdId)
        .order('joined_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!householdId,
  });
}

export function useLeaveHouseholdMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (householdId: string) => {
      // Löscht den eigenen Eintrag aus household_members (RLS erlaubt das für sich selbst)
      const { data, error } = await getSupabase()
        .from('household_members')
        .delete()
        .eq('household_id', householdId);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['households'] });
    },
  });
}

export function useDeleteHouseholdMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (householdId: string) => {
      // Nur der Admin/Ersteller darf löschen (RLS regelt das)
      const { data, error } = await getSupabase().from('households').delete().eq('id', householdId);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['households'] });
    },
  });
}
