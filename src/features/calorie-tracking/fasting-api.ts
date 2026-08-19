import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

export type FastingSessionRow = Database['public']['Tables']['fasting_sessions']['Row'];
export type FastingProtocol = '16:8' | '18:6' | '20:4' | '5:2' | 'omad' | 'custom';

export const FASTING_PROTOCOL_DURATIONS: Record<
  Exclude<FastingProtocol, 'custom' | '5:2'>,
  number
> = {
  '16:8': 16 * 60, // 960 min
  '18:6': 18 * 60, // 1080 min
  '20:4': 20 * 60, // 1200 min
  omad: 23 * 60, // 1380 min
};

export function fastingSessionsQueryKey(
  userId: string | undefined,
  childProfileId?: string | null,
) {
  return ['fasting', 'sessions', userId, childProfileId ?? null] as const;
}

export function useFastingSessions(userId: string | undefined, childProfileId?: string | null) {
  return useQuery({
    queryKey: fastingSessionsQueryKey(userId, childProfileId),
    queryFn: async (): Promise<FastingSessionRow[]> => {
      let query = getSupabase()
        .from('fasting_sessions')
        .select('*')
        .eq('user_id', userId as string)
        .is('deleted_at', null)
        .order('started_at', { ascending: false });

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

export function useActiveFastingSession(
  userId: string | undefined,
  childProfileId?: string | null,
) {
  const { data: sessions, ...rest } = useFastingSessions(userId, childProfileId);
  const activeSession = sessions?.find((s) => s.ended_at === null) ?? null;
  return { data: activeSession, ...rest };
}

export type StartFastInput = {
  userId: string;
  childProfileId?: string | null;
  protocol: FastingProtocol;
  targetDurationMinutes: number;
  startedAt?: string;
  notes?: string | null;
};

export function useStartFastMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: StartFastInput) => {
      const { data, error } = await getSupabase()
        .from('fasting_sessions')
        .insert({
          user_id: input.userId,
          child_profile_id: input.childProfileId ?? null,
          protocol: input.protocol,
          target_duration_minutes: input.targetDurationMinutes,
          started_at: input.startedAt ?? new Date().toISOString(),
          notes: input.notes?.trim() || null,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onMutate: async (input) => {
      const queryKey = fastingSessionsQueryKey(input.userId, input.childProfileId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<FastingSessionRow[]>(queryKey);

      const optimisticEntry: FastingSessionRow = {
        id: `optimistic-${Date.now()}`,
        user_id: input.userId,
        child_profile_id: input.childProfileId ?? null,
        protocol: input.protocol,
        target_duration_minutes: input.targetDurationMinutes,
        started_at: input.startedAt ?? new Date().toISOString(),
        ended_at: null,
        notes: input.notes ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      queryClient.setQueryData<FastingSessionRow[]>(queryKey, (old) => [
        optimisticEntry,
        ...(old ?? []),
      ]);

      return { previous, queryKey };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({
        queryKey: fastingSessionsQueryKey(variables.userId, variables.childProfileId),
      });
    },
  });
}

export function useEndFastMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      userId: _userId,
      childProfileId: _childProfileId,
      endedAt,
    }: {
      sessionId: string;
      userId: string;
      childProfileId?: string | null;
      endedAt?: string;
    }) => {
      const { data, error } = await getSupabase()
        .from('fasting_sessions')
        .update({ ended_at: endedAt ?? new Date().toISOString() })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onMutate: async ({ sessionId, userId, childProfileId, endedAt }) => {
      const queryKey = fastingSessionsQueryKey(userId, childProfileId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<FastingSessionRow[]>(queryKey);

      const effectiveEndedAt = endedAt ?? new Date().toISOString();
      queryClient.setQueryData<FastingSessionRow[]>(queryKey, (old) =>
        (old ?? []).map((session) =>
          session.id === sessionId ? { ...session, ended_at: effectiveEndedAt } : session,
        ),
      );

      return { previous, queryKey };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({
        queryKey: fastingSessionsQueryKey(variables.userId, variables.childProfileId),
      });
    },
  });
}

export function useDeleteFastingSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      userId: _userId,
      childProfileId: _childProfileId,
    }: {
      sessionId: string;
      userId: string;
      childProfileId?: string | null;
    }) => {
      const { error } = await getSupabase()
        .from('fasting_sessions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) throw new Error(error.message);
    },
    onMutate: async ({ sessionId, userId, childProfileId }) => {
      const queryKey = fastingSessionsQueryKey(userId, childProfileId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<FastingSessionRow[]>(queryKey);

      queryClient.setQueryData<FastingSessionRow[]>(queryKey, (old) =>
        (old ?? []).filter((session) => session.id !== sessionId),
      );

      return { previous, queryKey };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({
        queryKey: fastingSessionsQueryKey(variables.userId, variables.childProfileId),
      });
    },
  });
}
