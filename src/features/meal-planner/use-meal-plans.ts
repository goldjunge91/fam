import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { trackAnalyticsEvent } from '@/lib/analytics';
import { getDatabase } from '@/lib/db/local-client';
import { enqueueMutation } from '@/lib/db/outbox';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';
import {
  type CustomIngredient,
  customIngredientsSchema,
  customTitleSchema,
  parseCustomIngredients,
} from './domain/custom-ingredients';
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
  recipe_id: string | null;
  custom_title?: string | null;
  custom_ingredients?: CustomIngredient[];
  entry_date: string;
  meal_slot: MealSlot;
  servings_mode: ServingsMode;
  portions: number;
  people_count: number | null;
  /** Aus recipes gejoint, fuer die Chip-Beschriftung im Grid. */
  recipe_title: string;
  /** Aus recipes gejoint, damit Karten das private Rezept-Cover laden können. */
  recipe_cover_image_path: string | null;
};

type MealPlanEntryRow = Omit<MealPlanEntry, 'custom_ingredients'> & {
  custom_ingredients: string | null;
};

function mapMealPlanEntry(row: MealPlanEntryRow): MealPlanEntry {
  return { ...row, custom_ingredients: parseCustomIngredients(row.custom_ingredients ?? '[]') };
}

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
    networkMode: 'always',
  });
}

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
      const rows = await db.getAllAsync<MealPlanEntryRow>(
        `select e.id, e.meal_plan_id, e.household_id, e.recipe_id, e.entry_date, e.meal_slot,
                e.custom_title, e.custom_ingredients,
                e.servings_mode, e.portions, e.people_count,
                coalesce(e.custom_title, r.title, '?') as recipe_title,
                r.cover_image_path as recipe_cover_image_path
         from meal_plan_entries e
         left join recipes r on r.id = e.recipe_id
         where e.household_id = ? and e.deleted_at is null
           and e.entry_date >= ? and e.entry_date <= ?
         order by e.entry_date, e.meal_slot`,
        [householdId, startDate, endDate],
      );
      return rows.map(mapMealPlanEntry);
    },
    enabled: !!householdId,
    networkMode: 'always',
  });
}

export function useMealPlanEntries(mealPlanId: string | undefined) {
  return useQuery({
    queryKey: ['meal-plan-entries', mealPlanId],
    queryFn: async (): Promise<MealPlanEntry[]> => {
      if (!mealPlanId) return [];
      const db = await getDatabase();
      const rows = await db.getAllAsync<MealPlanEntryRow>(
        `select e.id, e.meal_plan_id, e.household_id, e.recipe_id, e.entry_date, e.meal_slot,
                e.custom_title, e.custom_ingredients,
                e.servings_mode, e.portions, e.people_count,
                coalesce(e.custom_title, r.title, '?') as recipe_title,
                r.cover_image_path as recipe_cover_image_path
         from meal_plan_entries e
         left join recipes r on r.id = e.recipe_id
         where e.meal_plan_id = ? and e.deleted_at is null
         order by e.entry_date, e.meal_slot`,
        [mealPlanId],
      );
      return rows.map(mapMealPlanEntry);
    },
    enabled: !!mealPlanId,
    networkMode: 'always',
  });
}

// ----------------------------------------------------------------- Mutations

export function useEnsureMealPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: 'always',
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
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'meal_plans',
            'insert',
            {
              id,
              household_id: input.household_id,
              name,
              week_start_date: input.week_start_date,
              created_by: input.created_by,
              created_at: iso,
            },
            ms,
          ),
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

type EntryInputBase = {
  meal_plan_id: string;
  household_id: string;
  entry_date: string;
  meal_slot: MealSlot;
  servings_mode: ServingsMode;
  portions: number;
  people_count: number | null;
  created_by: string;
};

export type EntryInput = EntryInputBase &
  (
    | { recipe_id: string; custom_title?: never; custom_ingredients?: never }
    | { recipe_id: null; custom_title: string; custom_ingredients: CustomIngredient[] }
  );

function entryContent(input: EntryInput) {
  if (!Number.isFinite(input.portions) || input.portions <= 0) {
    throw new Error('Portionen müssen positiv sein.');
  }
  if (input.recipe_id !== null) {
    return { recipe_id: input.recipe_id, custom_title: null, custom_ingredients: [] };
  }
  return {
    recipe_id: null,
    custom_title: customTitleSchema.parse(input.custom_title),
    custom_ingredients: customIngredientsSchema.parse(input.custom_ingredients),
  };
}

export function useAddEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: 'always',
    mutationFn: async (input: EntryInput) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const { iso, ms } = nowStamp();
      const content = entryContent(input);

      await enqueueMutation(db, {
        entity: 'meal_plan_entries',
        entityId: id,
        op: 'insert',
        payload: { ...input, ...content, id, created_at: iso, updated_at: iso },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'meal_plan_entries',
            'insert',
            { ...input, ...content, id, created_at: iso },
            ms,
          ),
      });

      return { id, ...input, ...content };
    },
    onSuccess: (_, variables) => {
      trackAnalyticsEvent('meal_plan_entry.create.completed', {
        meal_slot: variables.meal_slot,
      });
      queryClient.invalidateQueries({ queryKey: ['meal-plan-entries', variables.meal_plan_id] });
      queryClient.invalidateQueries({ queryKey: ['meal-plan-entries-range'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useUpdateEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: 'always',
    mutationFn: async (
      input: {
        id: string;
        meal_plan_id: string;
        household_id: string;
      } & (
        | {
            servings_mode: ServingsMode;
            portions: number;
            people_count: number | null;
            custom_title?: never;
            custom_ingredients?: never;
          }
        | {
            custom_title: string;
            custom_ingredients: CustomIngredient[];
            servings_mode?: ServingsMode;
            portions?: number;
            people_count?: number | null;
          }
      ),
    ) => {
      if (
        'custom_title' in input &&
        input.portions !== undefined &&
        (!Number.isFinite(input.portions) || input.portions <= 0)
      ) {
        throw new Error('Portionen müssen positiv sein.');
      }

      const db = await getDatabase();
      const { iso, ms } = nowStamp();
      const changes =
        'custom_title' in input
          ? {
              custom_title: customTitleSchema.parse(input.custom_title),
              custom_ingredients: customIngredientsSchema.parse(input.custom_ingredients),
              ...(input.portions === undefined
                ? {}
                : {
                    servings_mode: input.servings_mode ?? 'portions',
                    portions: input.portions,
                    people_count: input.people_count ?? null,
                  }),
            }
          : {
              servings_mode: input.servings_mode,
              portions: input.portions,
              people_count: input.people_count,
            };

      await enqueueMutation(db, {
        entity: 'meal_plan_entries',
        entityId: input.id,
        op: 'update',
        payload: {
          id: input.id,
          household_id: input.household_id,
          ...changes,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'meal_plan_entries',
            'update',
            {
              id: input.id,
              ...changes,
            },
            ms,
          ),
      });

      return input.id;
    },
    onSuccess: (_, variables) => {
      trackAnalyticsEvent('meal_plan_entry.update.completed');
      queryClient.invalidateQueries({ queryKey: ['meal-plan-entries', variables.meal_plan_id] });
      queryClient.invalidateQueries({ queryKey: ['meal-plan-entries-range'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useDeleteEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: 'always',
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
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'meal_plan_entries', 'delete', { id: input.id }, ms),
      });

      return input.id;
    },
    onSuccess: (_, variables) => {
      trackAnalyticsEvent('meal_plan_entry.delete.completed');
      queryClient.invalidateQueries({ queryKey: ['meal-plan-entries', variables.meal_plan_id] });
      queryClient.invalidateQueries({ queryKey: ['meal-plan-entries-range'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useReuseLastWeekMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: 'always',
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
        recipe_id: string | null;
        custom_title: string | null;
        custom_ingredients: string | null;
        entry_date: string;
        meal_slot: MealSlot;
        servings_mode: ServingsMode;
        portions: number;
        people_count: number | null;
      }>(
        `select recipe_id, custom_title, custom_ingredients, entry_date, meal_slot,
                servings_mode, portions, people_count
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
            custom_title: entry.custom_title,
            custom_ingredients: parseCustomIngredients(entry.custom_ingredients ?? '[]'),
            entry_date: newDate,
            meal_slot: entry.meal_slot,
            servings_mode: entry.servings_mode,
            portions: entry.portions,
            people_count: entry.people_count,
            created_by: input.created_by,
            created_at: iso,
            updated_at: iso,
          },
          applyLocally: (txn) =>
            applyLocalMirrorWrite(
              txn,
              'meal_plan_entries',
              'insert',
              {
                id,
                meal_plan_id: input.target_meal_plan_id,
                household_id: input.household_id,
                recipe_id: entry.recipe_id,
                custom_title: entry.custom_title,
                custom_ingredients: parseCustomIngredients(entry.custom_ingredients ?? '[]'),
                entry_date: newDate,
                meal_slot: entry.meal_slot,
                servings_mode: entry.servings_mode,
                portions: entry.portions,
                people_count: entry.people_count,
                created_by: input.created_by,
                created_at: iso,
              },
              ms,
            ),
        });
      }

      return { copied: lastEntries.length };
    },
    onSuccess: (result, variables) => {
      trackAnalyticsEvent('meal_plan.reuse.completed', { copied_count: result.copied });
      queryClient.invalidateQueries({
        queryKey: ['meal-plan-entries', variables.target_meal_plan_id],
      });
      queryClient.invalidateQueries({ queryKey: ['meal-plan-entries-range'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
