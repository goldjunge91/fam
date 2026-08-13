import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { getDatabase } from '@/lib/db/client';
import { enqueueMutation } from '@/lib/db/outbox';
import { addDays, defaultWeekPlanName, previousWeekStart } from './week';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner';
export type ServingsMode = 'portions' | 'people';

export type MealPlan = {
  id: string;
  household_id: string;
  name: string;
  week_start_date: string;
};

export type MealPlanEntry = {
  id: string;
  meal_plan_id: string;
  household_id: string;
  recipe_id: string;
  entry_date: string;
  meal_slot: MealSlot;
  servings_mode: ServingsMode;
  portions: number;
  people_count: number | null;
  /** Aus recipes gejoint, fuer die Chip-Beschriftung im Grid. */
  recipe_title: string;
};

function nowStamp() {
  return { iso: new Date().toISOString(), ms: Date.now() };
}

// ------------------------------------------------------------------- Queries

export function useMealPlan(householdId: string | undefined, weekStartDate: string) {
  return useQuery({
    queryKey: ['meal-plan', householdId, weekStartDate],
    queryFn: async (): Promise<MealPlan | null> => {
      if (!householdId) return null;
      const db = await getDatabase();
      const row = await db.getFirstAsync<MealPlan>(
        `select id, household_id, name, week_start_date
         from meal_plans
         where household_id = ? and week_start_date = ? and deleted_at is null
         limit 1`,
        [householdId, weekStartDate],
      );
      return row ?? null;
    },
    enabled: !!householdId,
  });
}

/**
 * Eintraege ueber einen beliebigen Datumsbereich, haushaltsweit — unabhaengig
 * von einem einzelnen `meal_plan_id`.
 *
 * Fuer die Tages-/3-Tage-Ansicht (#129-Nachtrag) reicht `useMealPlanEntries`
 * nicht: ein Fenster kann ueber zwei Kalenderwochen (und damit zwei
 * `meal_plans`-Zeilen) hinweg liegen. `entry_date`/`household_id` liegen
 * bereits denormalisiert auf `meal_plan_entries`, ein Filter direkt darauf
 * ist deshalb genauso billig wie ueber `meal_plan_id` und funktioniert fuer
 * jede Fensterbreite gleich.
 */
export function useMealPlanEntriesInRange(
  householdId: string | undefined,
  startDate: string,
  endDate: string,
) {
  return useQuery({
    queryKey: ['meal-plan-entries-range', householdId, startDate, endDate],
    queryFn: async (): Promise<MealPlanEntry[]> => {
      if (!householdId) return [];
      const db = await getDatabase();
      return db.getAllAsync<MealPlanEntry>(
        `select e.id, e.meal_plan_id, e.household_id, e.recipe_id, e.entry_date, e.meal_slot,
                e.servings_mode, e.portions, e.people_count,
                coalesce(r.title, '?') as recipe_title
         from meal_plan_entries e
         left join recipes r on r.id = e.recipe_id
         where e.household_id = ? and e.deleted_at is null
           and e.entry_date >= ? and e.entry_date <= ?
         order by e.entry_date, e.meal_slot`,
        [householdId, startDate, endDate],
      );
    },
    enabled: !!householdId,
  });
}

export function useMealPlanEntries(mealPlanId: string | undefined) {
  return useQuery({
    queryKey: ['meal-plan-entries', mealPlanId],
    queryFn: async (): Promise<MealPlanEntry[]> => {
      if (!mealPlanId) return [];
      const db = await getDatabase();
      return db.getAllAsync<MealPlanEntry>(
        `select e.id, e.meal_plan_id, e.household_id, e.recipe_id, e.entry_date, e.meal_slot,
                e.servings_mode, e.portions, e.people_count,
                coalesce(r.title, '?') as recipe_title
         from meal_plan_entries e
         left join recipes r on r.id = e.recipe_id
         where e.meal_plan_id = ? and e.deleted_at is null
         order by e.entry_date, e.meal_slot`,
        [mealPlanId],
      );
    },
    enabled: !!mealPlanId,
  });
}

// ----------------------------------------------------------------- Mutations

/**
 * Legt bei Bedarf den Wochenplan fuer `weekStartDate` an (get-or-create) —
 * pro Haushalt und Woche gibt es serverseitig nur einen, siehe
 * `meal_plans_household_week_unique` in 14_meal_plans.sql.
 */
export function useEnsureMealPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      household_id: string;
      week_start_date: string;
      created_by: string;
      name?: string;
    }): Promise<MealPlan> => {
      const db = await getDatabase();
      const existing = await db.getFirstAsync<MealPlan>(
        `select id, household_id, name, week_start_date
         from meal_plans
         where household_id = ? and week_start_date = ? and deleted_at is null
         limit 1`,
        [input.household_id, input.week_start_date],
      );
      if (existing) return existing;

      const id = Crypto.randomUUID();
      const { iso, ms } = nowStamp();
      const name = input.name ?? defaultWeekPlanName(input.week_start_date);

      await enqueueMutation(db, {
        entity: 'meal_plans',
        entityId: id,
        op: 'insert',
        payload: {
          id,
          household_id: input.household_id,
          name,
          week_start_date: input.week_start_date,
          created_by: input.created_by,
          created_at: iso,
          updated_at: iso,
        },
        applyLocally: async (txn) => {
          await txn.runAsync(
            `insert into meal_plans (id, household_id, name, week_start_date, created_by, created_at, updated_at, _dirty)
             values (?, ?, ?, ?, ?, ?, ?, 1)`,
            [id, input.household_id, name, input.week_start_date, input.created_by, iso, ms],
          );
        },
      });

      return { id, household_id: input.household_id, name, week_start_date: input.week_start_date };
    },
    onSuccess: (plan) => {
      queryClient.invalidateQueries({
        queryKey: ['meal-plan', plan.household_id, plan.week_start_date],
      });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export type EntryInput = {
  meal_plan_id: string;
  household_id: string;
  recipe_id: string;
  entry_date: string;
  meal_slot: MealSlot;
  servings_mode: ServingsMode;
  portions: number;
  people_count: number | null;
  created_by: string;
};

export function useAddEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: EntryInput) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const { iso, ms } = nowStamp();

      await enqueueMutation(db, {
        entity: 'meal_plan_entries',
        entityId: id,
        op: 'insert',
        payload: { ...input, id, created_at: iso, updated_at: iso },
        applyLocally: async (txn) => {
          await txn.runAsync(
            `insert into meal_plan_entries
               (id, meal_plan_id, household_id, recipe_id, entry_date, meal_slot,
                servings_mode, portions, people_count, created_by, created_at, updated_at, _dirty)
             values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
              id,
              input.meal_plan_id,
              input.household_id,
              input.recipe_id,
              input.entry_date,
              input.meal_slot,
              input.servings_mode,
              input.portions,
              input.people_count,
              input.created_by,
              iso,
              ms,
            ],
          );
        },
      });

      return { id, ...input };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['meal-plan-entries', variables.meal_plan_id] });
      queryClient.invalidateQueries({ queryKey: ['meal-plan-entries-range'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useUpdateEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      meal_plan_id: string;
      household_id: string;
      servings_mode: ServingsMode;
      portions: number;
      people_count: number | null;
    }) => {
      const db = await getDatabase();
      const { iso, ms } = nowStamp();

      await enqueueMutation(db, {
        entity: 'meal_plan_entries',
        entityId: input.id,
        op: 'update',
        payload: {
          id: input.id,
          household_id: input.household_id,
          servings_mode: input.servings_mode,
          portions: input.portions,
          people_count: input.people_count,
          updated_at: iso,
        },
        applyLocally: async (txn) => {
          await txn.runAsync(
            'update meal_plan_entries set servings_mode = ?, portions = ?, people_count = ?, updated_at = ?, _dirty = 1 where id = ?',
            [input.servings_mode, input.portions, input.people_count, ms, input.id],
          );
        },
      });

      return input.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['meal-plan-entries', variables.meal_plan_id] });
      queryClient.invalidateQueries({ queryKey: ['meal-plan-entries-range'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useDeleteEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; meal_plan_id: string; household_id: string }) => {
      const db = await getDatabase();
      const { iso, ms } = nowStamp();

      await enqueueMutation(db, {
        entity: 'meal_plan_entries',
        entityId: input.id,
        op: 'delete',
        payload: {
          id: input.id,
          household_id: input.household_id,
          deleted_at: iso,
          updated_at: iso,
        },
        applyLocally: async (txn) => {
          await txn.runAsync(
            'update meal_plan_entries set deleted_at = ?, updated_at = ?, _dirty = 1 where id = ?',
            [ms, ms, input.id],
          );
        },
      });

      return input.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['meal-plan-entries', variables.meal_plan_id] });
      queryClient.invalidateQueries({ queryKey: ['meal-plan-entries-range'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

/**
 * "Letzte Woche erneut verwenden" (#129-AC): kopiert alle Eintraege des
 * Vorwochenplans (falls vorhanden) in den (bei Bedarf neu angelegten)
 * aktuellen Wochenplan — neue IDs, gleiche Rezept-Zuordnung/Mengen, Datum um
 * 7 Tage verschoben.
 */
export function useReuseLastWeekMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      household_id: string;
      week_start_date: string;
      target_meal_plan_id: string;
      created_by: string;
    }) => {
      const db = await getDatabase();
      const lastWeekStart = previousWeekStart(input.week_start_date);

      const lastPlan = await db.getFirstAsync<{ id: string }>(
        `select id from meal_plans
         where household_id = ? and week_start_date = ? and deleted_at is null
         limit 1`,
        [input.household_id, lastWeekStart],
      );
      if (!lastPlan) return { copied: 0 };

      const lastEntries = await db.getAllAsync<{
        recipe_id: string;
        entry_date: string;
        meal_slot: MealSlot;
        servings_mode: ServingsMode;
        portions: number;
        people_count: number | null;
      }>(
        `select recipe_id, entry_date, meal_slot, servings_mode, portions, people_count
         from meal_plan_entries
         where meal_plan_id = ? and deleted_at is null`,
        [lastPlan.id],
      );

      for (const entry of lastEntries) {
        const id = Crypto.randomUUID();
        const { iso, ms } = nowStamp();
        const newDate = addDays(entry.entry_date, 7);

        await enqueueMutation(db, {
          entity: 'meal_plan_entries',
          entityId: id,
          op: 'insert',
          payload: {
            id,
            meal_plan_id: input.target_meal_plan_id,
            household_id: input.household_id,
            recipe_id: entry.recipe_id,
            entry_date: newDate,
            meal_slot: entry.meal_slot,
            servings_mode: entry.servings_mode,
            portions: entry.portions,
            people_count: entry.people_count,
            created_by: input.created_by,
            created_at: iso,
            updated_at: iso,
          },
          applyLocally: async (txn) => {
            await txn.runAsync(
              `insert into meal_plan_entries
                 (id, meal_plan_id, household_id, recipe_id, entry_date, meal_slot,
                  servings_mode, portions, people_count, created_by, created_at, updated_at, _dirty)
               values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
              [
                id,
                input.target_meal_plan_id,
                input.household_id,
                entry.recipe_id,
                newDate,
                entry.meal_slot,
                entry.servings_mode,
                entry.portions,
                entry.people_count,
                input.created_by,
                iso,
                ms,
              ],
            );
          },
        });
      }

      return { copied: lastEntries.length };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['meal-plan-entries', variables.target_meal_plan_id],
      });
      queryClient.invalidateQueries({ queryKey: ['meal-plan-entries-range'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
