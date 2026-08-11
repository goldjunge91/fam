import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session-provider';
import { householdsQueryKey } from '@/features/household/query-keys';
import type { Database } from '@/lib/database.types';
import { getDatabase } from '@/lib/db/client';
import { getSupabase } from '@/lib/supabase';
import { triggerHouseholdsPull } from '@/lib/sync/household-bootstrap-sync';

export { HOUSEHOLDS_QUERY_KEY, householdsQueryKey } from '@/features/household/query-keys';

/**
 * Form der lokal gespiegelten `households`-Zeile — bewusst nicht das volle
 * `Database['public']['Tables']['households']['Row']`: `updated_at` wird
 * lokal nicht selektiert (kein Konsument braucht es), und `created_by`/
 * `created_at` sind hier nullable, weil die lokale Spiegeltabelle (anders
 * als der Server) keine NOT-NULL-Constraints traegt (siehe migrations.ts).
 */
export type Household = {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string | null;
};

/**
 * Liest alle Haushalte, in denen der aktuell angemeldete Nutzer Mitglied
 * ist, aus dem lokalen SQLite-Spiegel — network-unabhaengig und praktisch
 * instant, auch im Kaltstart ohne Verbindung. `household-bootstrap-sync.ts`
 * haelt den Spiegel im Hintergrund frisch (Pull bei Sitzungsbeginn, alle
 * 20s, bei Reconnect und beim Vordergrund-Wechsel).
 *
 * Der Schluessel traegt die Nutzer-Id, und das ist keine Kosmetik: Mit einem
 * gemeinsamen `['households']` blieb ein bereits gemounteter Observer nach
 * einem Nutzerwechsel an den Daten des Vornutzers haengen — `queryClient.clear()`
 * beim Logout benachrichtigt gemountete Observer naemlich nicht, und danach
 * findet auch keine Invalidierung sie mehr. Mit nutzerspezifischem Schluessel
 * wechselt der Observer beim Anmelden auf eine andere Query und *kann* die
 * fremden Daten gar nicht mehr ausliefern.
 */
export function useHouseholds() {
  const { session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: householdsQueryKey(userId),
    queryFn: async () => {
      const db = await getDatabase();
      return db.getAllAsync<Household>(
        'select id, name, created_by, created_at from households order by created_at asc',
      );
    },
    enabled: !!userId,
  });
}

export function useCreateHouseholdMutation() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async (householdName: string) => {
      const { data, error } = await getSupabase().rpc('create_household', {
        household_name: householdName,
      });

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: async () => {
      if (userId) {
        await triggerHouseholdsPull(userId, queryClient);
      }
    },
  });
}

/**
 * Mitglieder eines Haushalts samt Anzeigename und Avatar.
 *
 * Ueber das RPC `household_member_profiles` statt per Join auf `profiles`:
 * `profiles` ist bewusst streng privat — dort liegen Geburtsdatum, Geschlecht,
 * Koerpergroesse und Aktivitaetslevel. Die RLS-Policy gibt deshalb nur die
 * eigene Zeile frei, und der fruehere Join `profiles:user_id(*)` lieferte fuer
 * alle anderen `null`; im Screen stand dann "Unbekanntes Mitglied".
 *
 * Eine Policy koennte das nicht loesen: RLS wirkt auf Zeilen, nicht auf
 * Spalten. Das RPC gibt genau die zwei Spalten heraus, die zur Identifikation
 * noetig sind, und prueft serverseitig die Mitgliedschaft.
 */
export function useHouseholdMembers(householdId: string) {
  return useQuery({
    queryKey: ['households', householdId, 'members'],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('household_member_profiles', {
        hid: householdId,
      });

      if (error) throw new Error(error.message);
      return data ?? [];
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

      if (error) throw new Error(error.message);
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

      if (error) throw new Error(error.message);
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
  const { session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async (householdId: string) => {
      // Löscht den eigenen Eintrag aus household_members (RLS erlaubt das für sich selbst)
      const { data, error } = await getSupabase()
        .from('household_members')
        .delete()
        .eq('household_id', householdId);

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: async () => {
      if (userId) {
        await triggerHouseholdsPull(userId, queryClient);
      }
    },
  });
}

export function useDeleteHouseholdMutation() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async (householdId: string) => {
      // Nur der Admin/Ersteller darf löschen (RLS regelt das)
      const { data, error } = await getSupabase().from('households').delete().eq('id', householdId);

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: async () => {
      if (userId) {
        await triggerHouseholdsPull(userId, queryClient);
      }
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

      if (error) throw new Error(error.message);
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

      if (error) throw new Error(error.message);
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

      if (error) throw new Error(error.message);
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
  const { session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async (inviteToken: string) => {
      const { data, error } = await getSupabase().rpc('redeem_invite', {
        invite_token: inviteToken,
      });

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: async () => {
      if (userId) {
        await triggerHouseholdsPull(userId, queryClient);
      }
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

      if (error) throw new Error(error.message);
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

      if (error) throw new Error(error.message);
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

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['households', variables.householdId, 'children'],
      });
    },
  });
}

export function useUpdateChildProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      householdId: _householdId,
      displayName,
      birthDate,
      sex,
      heightCm,
    }: {
      id: string;
      householdId: string;
      displayName?: string;
      birthDate?: string | null;
      sex?: string | null;
      heightCm?: number | null;
    }) => {
      const updates: Database['public']['Tables']['child_profiles']['Update'] = {
        updated_at: new Date().toISOString(),
      };
      if (displayName !== undefined) updates.display_name = displayName;
      if (birthDate !== undefined) updates.birth_date = birthDate;
      if (sex !== undefined) updates.sex = sex;
      if (heightCm !== undefined) updates.height_cm = heightCm;

      const { data, error } = await getSupabase()
        .from('child_profiles')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['households', variables.householdId, 'children'],
      });
    },
  });
}
