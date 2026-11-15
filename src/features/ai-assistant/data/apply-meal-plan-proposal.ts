import * as Crypto from 'expo-crypto';
import { defaultWeekPlanName, getWeekStart } from '@/features/meal-planner/week';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { getDatabase } from '@/lib/db/local-client';
import { type EnqueueMutationInput, enqueueMutationsInExclusiveTransaction } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { toEpochMs } from '@/lib/sync/cursor';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';
import type { AssistantProposal } from '../types';
import { validateAssistantMealPlanProposal } from './assistant-api';

type MealPlanProposal = Extract<AssistantProposal, { kind: 'meal_plan_proposal.v1' }>;

type ApplyMealPlanProposalErrorCode =
  | 'invalid_proposal_snapshot'
  | 'food_rules_changed'
  | 'food_rule_coverage_changed'
  | 'recipe_changed'
  | 'recipe_evidence_changed'
  | 'meal_slot_conflict';

export class ApplyMealPlanProposalError extends Error {
  constructor(readonly code: ApplyMealPlanProposalErrorCode) {
    super(code);
    this.name = 'ApplyMealPlanProposalError';
  }
}

type ProposalRecipeVersion = NonNullable<
  MealPlanProposal['foodRuleCoverage']
>['recipeVersions'][number];

function fail(code: ApplyMealPlanProposalErrorCode): never {
  throw new ApplyMealPlanProposalError(code);
}

function assertValidProposal(proposal: MealPlanProposal): Map<string, ProposalRecipeVersion> {
  const coverage = proposal.foodRuleCoverage;
  if (coverage?.status !== 'clear' || coverage.rulesUpdatedAt !== proposal.foodRulesUpdatedAt) {
    return fail('invalid_proposal_snapshot');
  }

  const recipeIds = new Set(proposal.meals.map((meal) => meal.recipeId));
  const versions = new Map(coverage.recipeVersions.map((version) => [version.recipeId, version]));
  if (
    proposal.meals.length < 1 ||
    proposal.meals.length > 7 ||
    versions.size !== coverage.recipeVersions.length ||
    versions.size !== recipeIds.size ||
    [...recipeIds].some((recipeId) => !recipeId || !versions.has(recipeId)) ||
    coverage.recipeVersions.some((version) => !version.recipeUpdatedAt || !version.coverageVersion)
  ) {
    return fail('invalid_proposal_snapshot');
  }

  const slots = new Set<string>();
  let weekStart: string | null = null;
  for (const meal of proposal.meals) {
    const date = new Date(`${meal.date}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(meal.date) ||
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== meal.date
    ) {
      return fail('invalid_proposal_snapshot');
    }
    const currentWeekStart = getWeekStart(meal.date);
    if (weekStart !== null && weekStart !== currentWeekStart) {
      return fail('invalid_proposal_snapshot');
    }
    weekStart = currentWeekStart;

    const slotKey = `${meal.date}:${meal.mealSlot}`;
    if (
      !['breakfast', 'lunch', 'dinner'].includes(meal.mealSlot) ||
      !Number.isInteger(meal.portions) ||
      meal.portions < 1 ||
      meal.portions > 12 ||
      slots.has(slotKey)
    )
      return fail('invalid_proposal_snapshot');
    slots.add(slotKey);

    const version = versions.get(meal.recipeId);
    if (!version || version.recipeUpdatedAt !== meal.recipeUpdatedAt) {
      return fail('invalid_proposal_snapshot');
    }
  }
  return versions;
}

function localTimestampMs(value: number | string): number {
  if (typeof value === 'number') return value;
  if (/^\d+$/.test(value)) return Number(value);
  try {
    return toEpochMs(value);
  } catch {
    return Number.NaN;
  }
}

async function buildProposalMutations(
  txn: SqlDatabase,
  input: {
    householdId: string;
    userId: string;
    proposal: MealPlanProposal;
    recipeVersions: Map<string, ProposalRecipeVersion>;
    createdAt: string;
    nowMs: number;
  },
): Promise<EnqueueMutationInput[]> {
  const recipeIds = [...input.recipeVersions.keys()];
  const currentRecipes = await txn.getAllAsync<{
    id: string;
    household_id: string;
    updated_at: number | string;
  }>(
    `select id, household_id, updated_at from recipes
     where id in (${recipeIds.map(() => '?').join(', ')})
       and household_id = ? and deleted_at is null`,
    [...recipeIds, input.householdId],
  );
  if (currentRecipes.length !== recipeIds.length) fail('recipe_changed');

  const recipesById = new Map(currentRecipes.map((recipe) => [recipe.id, recipe]));
  for (const [recipeId, expected] of input.recipeVersions) {
    const recipe = recipesById.get(recipeId);
    if (!recipe || recipe.household_id !== input.householdId) fail('recipe_changed');
    if (localTimestampMs(recipe.updated_at) !== toEpochMs(expected.recipeUpdatedAt)) {
      fail('recipe_evidence_changed');
    }
  }

  const firstMeal = input.proposal.meals[0];
  if (!firstMeal) fail('invalid_proposal_snapshot');
  const weekStartDate = getWeekStart(firstMeal.date);
  const weekEndDate = new Date(`${weekStartDate}T00:00:00.000Z`);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
  const weekEnd = weekEndDate.toISOString().slice(0, 10);
  const plan = await txn.getFirstAsync<{
    id: string;
    household_id: string;
    name: string;
    week_start_date: string;
  }>(
    `select id, household_id, name, week_start_date from meal_plans
     where household_id = ? and week_start_date = ? and deleted_at is null limit 1`,
    [input.householdId, weekStartDate],
  );
  const currentSlots = await txn.getAllAsync<{
    entry_date: string;
    meal_slot: string;
    recipe_id: string | null;
    servings_mode: string;
    portions: number;
    people_count: number | null;
  }>(
    `select entry_date, meal_slot, recipe_id, servings_mode, portions, people_count
     from meal_plan_entries
     where household_id = ? and deleted_at is null and entry_date >= ? and entry_date <= ?`,
    [input.householdId, weekStartDate, weekEnd],
  );
  const slotsByKey = new Map<string, typeof currentSlots>();
  for (const current of currentSlots) {
    const key = `${current.entry_date}:${current.meal_slot}`;
    slotsByKey.set(key, [...(slotsByKey.get(key) ?? []), current]);
  }

  const mealsToAdd = input.proposal.meals.filter((meal) => {
    const existing = slotsByKey.get(`${meal.date}:${meal.mealSlot}`) ?? [];
    if (existing.length === 0) return true;
    if (
      existing.length === 1 &&
      existing[0]?.recipe_id === meal.recipeId &&
      existing[0]?.servings_mode === 'portions' &&
      existing[0]?.portions === meal.portions &&
      existing[0]?.people_count === null
    ) {
      return false;
    }
    return fail('meal_slot_conflict');
  });

  if (mealsToAdd.length === 0) return [];

  const planId = plan?.id ?? Crypto.randomUUID();
  const planName = plan?.name ?? defaultWeekPlanName(weekStartDate);
  const mutations: EnqueueMutationInput[] = [];
  if (!plan) {
    const payload = {
      id: planId,
      household_id: input.householdId,
      name: planName,
      week_start_date: weekStartDate,
      created_by: input.userId,
      created_at: input.createdAt,
      updated_at: input.createdAt,
    };
    mutations.push({
      entity: 'meal_plans',
      entityId: planId,
      op: 'insert',
      payload,
      now: input.nowMs,
      applyLocally: (transaction) =>
        applyLocalMirrorWrite(transaction, 'meal_plans', 'insert', payload, input.nowMs),
    });
  }

  for (const meal of mealsToAdd) {
    const id = Crypto.randomUUID();
    const payload = {
      id,
      meal_plan_id: planId,
      household_id: input.householdId,
      recipe_id: meal.recipeId,
      custom_title: null,
      custom_ingredients: [],
      entry_date: meal.date,
      meal_slot: meal.mealSlot,
      servings_mode: 'portions',
      portions: meal.portions,
      people_count: null,
      created_by: input.userId,
      created_at: input.createdAt,
      updated_at: input.createdAt,
    };
    mutations.push({
      entity: 'meal_plan_entries',
      entityId: id,
      op: 'insert',
      payload,
      now: input.nowMs,
      applyLocally: (transaction) =>
        applyLocalMirrorWrite(transaction, 'meal_plan_entries', 'insert', payload, input.nowMs),
    });
  }

  return mutations;
}

/** Revalidates current server evidence, then applies every local mutation atomically. */
export async function applyAssistantMealPlanProposal(input: {
  householdId: string;
  userId: string;
  proposal: MealPlanProposal;
}): Promise<{ addedCount: number; totalCount: number }> {
  const recipeVersions = assertValidProposal(input.proposal);
  const validation = await validateAssistantMealPlanProposal({
    householdId: input.householdId,
    proposal: input.proposal,
  });
  if (!validation.valid) {
    if (validation.reason === 'food_rules_changed') fail('food_rules_changed');
    if (validation.reason === 'food_rule_coverage_changed') fail('food_rule_coverage_changed');
    if (validation.reason === 'recipe_changed') fail('recipe_changed');
    if (validation.reason === 'recipe_evidence_changed') fail('recipe_evidence_changed');
    fail('invalid_proposal_snapshot');
  }

  const db = await getDatabase();
  const createdAt = new Date().toISOString();
  let addedCount = 0;
  let addedMealSlots: MealPlanProposal['meals'][number]['mealSlot'][] = [];
  await enqueueMutationsInExclusiveTransaction(db, async (txn) => {
    const mutations = await buildProposalMutations(txn, {
      householdId: input.householdId,
      userId: input.userId,
      proposal: input.proposal,
      recipeVersions,
      createdAt,
      nowMs: Date.parse(createdAt),
    });
    addedCount = mutations.filter((mutation) => mutation.entity === 'meal_plan_entries').length;
    addedMealSlots = mutations
      .filter((mutation) => mutation.entity === 'meal_plan_entries')
      .map(
        (mutation) => mutation.payload.meal_slot as MealPlanProposal['meals'][number]['mealSlot'],
      );
    return mutations;
  });

  for (const mealSlot of addedMealSlots) {
    try {
      trackAnalyticsEvent('meal_plan_entry.create.completed', { meal_slot: mealSlot });
    } catch {
      // Telemetrie darf eine bereits gespeicherte Wochenplan-Transaktion nicht als fehlgeschlagen melden.
    }
  }

  return { addedCount, totalCount: input.proposal.meals.length };
}
