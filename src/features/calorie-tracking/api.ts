import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { GoalType } from '@/features/calorie-tracking/tdee';
import type { Database } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

/**
 * `food_entries`/`weight_entries`/`user_goals` sind bewusst NICHT Teil des
 * lokalen SQLite-Sync-Engines (`src/lib/db/entities.ts`): sie sind streng
 * privat pro Account, ohne Haushaltsbezug (siehe Kommentar am Kopf von
 * `supabase/schemas/09_tracking.sql`). Direkter Supabase-Zugriff + React
 * Query, genau wie `src/features/household/api.ts` fuer `child_profiles`.
 */

export type FoodEntryRow = Database['public']['Tables']['food_entries']['Row'];
export type UserGoalRow = Database['public']['Tables']['user_goals']['Row'];
export type WeightEntryRow = Database['public']['Tables']['weight_entries']['Row'];

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

// --------------------------------------------------------------------- Ziele

export function currentGoalQueryKey(userId: string | undefined, childProfileId?: string | null) {
  return ['calorie-tracking', 'goal', 'current', userId, childProfileId ?? null] as const;
}

/**
 * Aktuell gueltiges Ziel: die juengste nicht geloeschte `user_goals`-Zeile.
 * `user_goals` historisiert ueber `valid_from` statt zu ueberschreiben — ein
 * neues Ziel ist immer ein Insert, nie ein Update (siehe `useSetGoalMutation`).
 *
 * `childProfileId` filtert zusaetzlich zu `user_id` (#65/#85): `undefined`/
 * `null` liest das Ziel des Erwachsenen selbst (`child_profile_id is null`),
 * eine id liest das Ziel des jeweiligen Kindes.
 */
export function useCurrentGoal(userId: string | undefined, childProfileId?: string | null) {
  return useQuery({
    queryKey: currentGoalQueryKey(userId, childProfileId),
    queryFn: async () => {
      let query = getSupabase()
        .from('user_goals')
        .select('*')
        .eq('user_id', userId as string)
        .is('deleted_at', null);
      query = childProfileId
        ? query.eq('child_profile_id', childProfileId)
        : query.is('child_profile_id', null);

      const { data, error } = await query
        .order('valid_from', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!userId,
  });
}

export function useSetGoalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      userId: string;
      goalType: GoalType;
      rateKgPerWeek: number | null;
      dailyKcal: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
      netCarbsG?: number | null;
      targetWeightKg?: number | null;
      childProfileId?: string | null;
    }) => {
      const { data, error } = await getSupabase()
        .from('user_goals')
        .insert({
          user_id: input.userId,
          goal_type: input.goalType,
          rate_kg_per_week: input.rateKgPerWeek,
          daily_kcal: input.dailyKcal,
          protein_g: input.proteinG,
          carbs_g: input.carbsG,
          fat_g: input.fatG,
          net_carbs_g: input.netCarbsG ?? null,
          target_weight_kg: input.targetWeightKg ?? null,
          child_profile_id: input.childProfileId ?? null,
        })
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: currentGoalQueryKey(variables.userId, variables.childProfileId),
      });
    },
  });
}

// ------------------------------------------------------------------- Gewicht

export function latestWeightEntryQueryKey(userId: string | undefined) {
  return ['calorie-tracking', 'weight', 'latest', userId] as const;
}

export function useLatestWeightEntry(userId: string | undefined) {
  return useQuery({
    queryKey: latestWeightEntryQueryKey(userId),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('weight_entries')
        .select('*')
        .eq('user_id', userId as string)
        .is('deleted_at', null)
        .order('measured_on', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!userId,
  });
}

export function useAddWeightEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { userId: string; weightKg: number; measuredOn?: string }) => {
      const { data, error } = await getSupabase()
        .from('weight_entries')
        .insert({
          user_id: input.userId,
          weight_kg: input.weightKg,
          measured_on: input.measuredOn,
        })
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: latestWeightEntryQueryKey(variables.userId) });
    },
  });
}

/**
 * Letzte Tagebucheintraege ueber alle Tage hinweg — Grundlage fuer
 * "Zuletzt"/"Haeufig" bei der Lebensmittelsuche (`food-history.ts`
 * verarbeitet das Ergebnis weiter). Kein eigener Query pro Tab: beide
 * Ansichten leiten sich clientseitig aus derselben Liste ab.
 *
 * Quelle ist die lokale `product_usage`-Tabelle (`use-local-food-usage.ts`),
 * nicht Supabase — siehe dort fuer die Begruendung (#79: offline-faehig und
 * nach Mahlzeitart gefiltert).
 */

// ------------------------------------------------------------- Tagebuch

export function foodEntriesQueryKey(
  userId: string | undefined,
  isoDate: string,
  childProfileId?: string | null,
) {
  return ['calorie-tracking', 'food-entries', userId, isoDate, childProfileId ?? null] as const;
}

/**
 * Alle Tagebucheintraege eines Kalendertags (#85/#87), aelteste zuerst.
 *
 * `childProfileId` filtert zusaetzlich zu `user_id` (#65/#85): `undefined`/
 * `null` zeigt die Eintraege des Erwachsenen selbst, eine id die eines
 * bestimmten Kindes — beide liegen unter demselben `user_id` (dem loggenden
 * Erwachsenen), `child_profile_id` ist nur ein Zusatz-Tag.
 */
export function useFoodEntries(
  userId: string | undefined,
  isoDate: string,
  childProfileId?: string | null,
) {
  return useQuery({
    queryKey: foodEntriesQueryKey(userId, isoDate, childProfileId),
    queryFn: async () => {
      let query = getSupabase()
        .from('food_entries')
        .select('*')
        .eq('user_id', userId as string)
        .eq('logged_on', isoDate)
        .is('deleted_at', null);
      query = childProfileId
        ? query.eq('child_profile_id', childProfileId)
        : query.is('child_profile_id', null);

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) throw new Error(error.message);
      return data;
    },
    // isoDate kommt bei manchen Aufrufern aus Router-Params und kann fehlen
    // (#food-entries-query) — ohne die Absicherung schickt PostgREST den
    // JS-Wert `undefined` als woertliche Zeichenkette an Postgres.
    enabled: !!userId && !!isoDate,
  });
}

export type FoodEntryInput = {
  userId: string;
  loggedOn: string;
  loggedAt?: string;
  mealType: MealType;
  name: string;
  quantity: number;
  unit: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG?: number | null;
  productId?: string | null;
  childProfileId?: string | null;
};

export function useAddFoodEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: FoodEntryInput) => {
      const { data, error } = await getSupabase()
        .from('food_entries')
        .insert({
          user_id: input.userId,
          logged_on: input.loggedOn,
          logged_at: input.loggedAt ?? new Date().toISOString(),
          meal_type: input.mealType,
          name: input.name,
          quantity: input.quantity,
          unit: input.unit,
          kcal: input.kcal,
          protein_g: input.proteinG,
          carbs_g: input.carbsG,
          fat_g: input.fatG,
          fiber_g: input.fiberG ?? null,
          product_id: input.productId ?? null,
          child_profile_id: input.childProfileId ?? null,
        })
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: foodEntriesQueryKey(
          variables.userId,
          variables.loggedOn,
          variables.childProfileId,
        ),
      });
    },
  });
}

export function useUpdateFoodEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: Partial<Omit<FoodEntryInput, 'userId' | 'loggedOn'>> & {
        id: string;
        userId: string;
        loggedOn: string;
      },
    ) => {
      const updates: Database['public']['Tables']['food_entries']['Update'] = {
        updated_at: new Date().toISOString(),
      };
      if (input.mealType !== undefined) updates.meal_type = input.mealType;
      if (input.name !== undefined) updates.name = input.name;
      if (input.quantity !== undefined) updates.quantity = input.quantity;
      if (input.unit !== undefined) updates.unit = input.unit;
      if (input.kcal !== undefined) updates.kcal = input.kcal;
      if (input.proteinG !== undefined) updates.protein_g = input.proteinG;
      if (input.carbsG !== undefined) updates.carbs_g = input.carbsG;
      if (input.fatG !== undefined) updates.fat_g = input.fatG;
      if (input.fiberG !== undefined) updates.fiber_g = input.fiberG;
      if (input.productId !== undefined) updates.product_id = input.productId;

      const { data, error } = await getSupabase()
        .from('food_entries')
        .update(updates)
        .eq('id', input.id)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: foodEntriesQueryKey(variables.userId, variables.loggedOn),
      });
    },
  });
}

export function useDeleteFoodEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      userId: _userId,
      loggedOn: _loggedOn,
    }: {
      id: string;
      userId: string;
      loggedOn: string;
    }) => {
      // Soft-Delete: `deleted_at` statt Zeile loeschen, konsistent mit dem
      // Spaltendesign der Tabelle (Vergangenheit bleibt fuer Auswertungen erhalten).
      const { data, error } = await getSupabase()
        .from('food_entries')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: foodEntriesQueryKey(variables.userId, variables.loggedOn),
      });
    },
  });
}

/** Macht `useDeleteFoodEntryMutation` rueckgaengig (#86) — gleiche Architektur, kein Sync-Layer noetig. */
export function useRestoreFoodEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      userId: _userId,
      loggedOn: _loggedOn,
    }: {
      id: string;
      userId: string;
      loggedOn: string;
    }) => {
      const { data, error } = await getSupabase()
        .from('food_entries')
        .update({ deleted_at: null })
        .eq('id', id);

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: foodEntriesQueryKey(variables.userId, variables.loggedOn),
      });
    },
  });
}

export function useUpdateTrackingDayStartTimeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, time }: { userId: string; time: string }) => {
      const { error } = await getSupabase()
        .from('profiles')
        .update({ tracking_day_start_time: time })
        .eq('id', userId);

      if (error) throw new Error(error.message);
    },
    onMutate: async ({ userId, time }) => {
      const queryKey = ['profile', userId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: Record<string, unknown> | undefined) =>
        old ? { ...old, tracking_day_start_time: time } : old,
      );
      return { previous, queryKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profile', variables.userId] });
    },
  });
}

export type TrackingMethod =
  | 'standard'
  | 'glp1'
  | 'fasting'
  | 'keto'
  | 'workouts'
  | 'cgm'
  | 'volumetrics';

export function useUpdateTrackingMethodMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, method }: { userId: string; method: TrackingMethod }) => {
      const { error } = await getSupabase()
        .from('profiles')
        .update({ tracking_method: method })
        .eq('id', userId);

      if (error) throw new Error(error.message);
    },
    onMutate: async ({ userId, method }) => {
      const queryKey = ['profile', userId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: Record<string, unknown> | undefined) =>
        old ? { ...old, tracking_method: method } : old,
      );
      return { previous, queryKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profile', variables.userId] });
    },
  });
}
