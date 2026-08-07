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

export function useUpdateMemberRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      householdId,
      userId,
      role,
    }: {
      householdId: string;
      userId: string;
      role: 'admin' | 'member';
    }) => {
      const { data, error } = await getSupabase()
        .from('household_members')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('household_id', householdId)
        .eq('user_id', userId);

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['households', variables.householdId, 'members'],
      });
    },
  });
}

export function useRemoveMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ householdId, userId }: { householdId: string; userId: string }) => {
      const { data, error } = await getSupabase()
        .from('household_members')
        .delete()
        .eq('household_id', householdId)
        .eq('user_id', userId);

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['households', variables.householdId, 'members'],
      });
    },
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

export function useHouseholdInvites(householdId: string) {
  return useQuery({
    queryKey: ['households', householdId, 'invites'],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('household_invites')
        .select('*')
        .eq('household_id', householdId)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!householdId,
  });
}

export function useCreateInviteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      householdId,
      createdBy,
      expiresDays = 7,
      maxUses = 1,
    }: {
      householdId: string;
      createdBy: string;
      expiresDays?: number;
      maxUses?: number;
    }) => {
      const expiresAt = new Date(Date.now() + expiresDays * 86400000).toISOString();
      const { data, error } = await getSupabase()
        .from('household_invites')
        .insert({
          household_id: householdId,
          created_by: createdBy,
          expires_at: expiresAt,
          max_uses: maxUses,
        })
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['households', variables.householdId, 'invites'],
      });
    },
  });
}

export function useRevokeInviteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      inviteId,
      householdId: _householdId,
    }: {
      inviteId: string;
      householdId: string;
    }) => {
      const { data, error } = await getSupabase()
        .from('household_invites')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', inviteId);

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['households', variables.householdId, 'invites'],
      });
    },
  });
}

export function useRedeemInviteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteToken: string) => {
      const { data, error } = await getSupabase().rpc('redeem_invite', {
        invite_token: inviteToken,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['households'] });
    },
  });
}

export function useChildProfiles(householdId: string) {
  return useQuery({
    queryKey: ['households', householdId, 'children'],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('child_profiles')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!householdId,
  });
}

export function useAddChildProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      householdId,
      displayName,
      birthDate,
      sex,
      heightCm,
      managedBy,
    }: {
      householdId: string;
      displayName: string;
      birthDate?: string | null;
      sex?: string | null;
      heightCm?: number | null;
      managedBy?: string | null;
    }) => {
      const { data, error } = await getSupabase()
        .from('child_profiles')
        .insert({
          household_id: householdId,
          display_name: displayName,
          birth_date: birthDate ?? null,
          sex: sex ?? null,
          height_cm: heightCm ?? null,
          managed_by: managedBy ?? null,
        })
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['households', variables.householdId, 'children'],
      });
    },
  });
}

export function useDeleteChildProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, householdId: _householdId }: { id: string; householdId: string }) => {
      const { data, error } = await getSupabase().from('child_profiles').delete().eq('id', id);

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['households', variables.householdId, 'children'],
      });
    },
  });
}
