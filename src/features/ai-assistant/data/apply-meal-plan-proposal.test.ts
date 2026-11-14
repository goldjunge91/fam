import * as Crypto from 'expo-crypto';

import { getDatabase } from '@/lib/db/local-client';
import type { EnqueueMutationInput } from '@/lib/db/outbox';
import * as Outbox from '@/lib/db/outbox';
import type { SerializedSqlDatabase } from '@/lib/db/serialize';
import type { SqlDatabase } from '@/lib/db/types';
import type { AssistantProposal } from '../types';
import {
  ApplyMealPlanProposalError,
  applyAssistantMealPlanProposal,
} from './apply-meal-plan-proposal';
import { validateAssistantMealPlanProposal } from './assistant-api';

const mockGetAllAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockBuildTransaction = {
  getAllAsync: (...args: unknown[]) => mockGetAllAsync(...args),
  getFirstAsync: (...args: unknown[]) => mockGetFirstAsync(...args),
} as unknown as SqlDatabase;
let mockBuiltMutations: readonly EnqueueMutationInput[] = [];

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: jest.fn() }));
jest.mock('@/lib/db/local-client', () => ({ getDatabase: jest.fn() }));
jest.mock('@/lib/db/outbox', () => ({
  enqueueMutationsInExclusiveTransaction: jest.fn(),
}));
jest.mock('./assistant-api', () => ({
  validateAssistantMealPlanProposal: jest.fn(),
}));

function mealPlanProposal(): Extract<AssistantProposal, { kind: 'meal_plan_proposal.v1' }> {
  return {
    kind: 'meal_plan_proposal.v1',
    foodRulesUpdatedAt: '2026-11-08T09:00:00.000Z',
    foodRuleCoverage: {
      status: 'clear',
      rulesUpdatedAt: '2026-11-08T09:00:00.000Z',
      recipeVersions: [
        {
          recipeId: 'recipe-1',
          recipeUpdatedAt: '2026-11-08T08:30:00.000Z',
          coverageVersion: 'reviewed-evidence-v1',
        },
      ],
    },
    meals: [
      {
        date: '2026-11-09',
        mealSlot: 'dinner',
        recipeId: 'recipe-1',
        recipeTitle: 'Tomatenpfanne',
        recipeUpdatedAt: '2026-11-08T08:30:00.000Z',
        portions: 2,
        rationale: 'Passt zum Montag.',
      },
      {
        date: '2026-11-11',
        mealSlot: 'dinner',
        recipeId: 'recipe-1',
        recipeTitle: 'Tomatenpfanne',
        recipeUpdatedAt: '2026-11-08T08:30:00.000Z',
        portions: 3,
        rationale: 'Passt zur Wochenmitte.',
      },
    ],
    safetyNote: 'Regeln wurden abgeglichen.',
  };
}

describe('applyAssistantMealPlanProposal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuiltMutations = [];
    mockGetAllAsync.mockReset();
    mockGetFirstAsync.mockReset().mockResolvedValue(null);
    jest.mocked(getDatabase).mockResolvedValue({} as SerializedSqlDatabase);
    jest
      .mocked(Crypto.randomUUID)
      .mockReset()
      .mockReturnValueOnce('plan-id')
      .mockReturnValueOnce('entry-id-1')
      .mockReturnValueOnce('entry-id-2');
    jest.mocked(validateAssistantMealPlanProposal).mockResolvedValue({ valid: true });
    jest
      .mocked(Outbox.enqueueMutationsInExclusiveTransaction)
      .mockImplementation(async (_db, build) => {
        mockBuiltMutations = await build(mockBuildTransaction);
      });
  });

  it('validates current evidence and enqueues a complete week as one transaction', async () => {
    mockGetAllAsync
      .mockResolvedValueOnce([
        {
          id: 'recipe-1',
          household_id: 'household-1',
          updated_at: Date.parse('2026-11-08T08:30:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await applyAssistantMealPlanProposal({
      householdId: 'household-1',
      userId: 'user-1',
      proposal: mealPlanProposal(),
    });

    expect(validateAssistantMealPlanProposal).toHaveBeenCalledTimes(1);
    expect(Outbox.enqueueMutationsInExclusiveTransaction).toHaveBeenCalledTimes(1);
    expect(mockBuiltMutations.map(({ entity }) => entity)).toEqual([
      'meal_plans',
      'meal_plan_entries',
      'meal_plan_entries',
    ]);
    expect(mockBuiltMutations[0]?.payload).toMatchObject({
      id: 'plan-id',
      household_id: 'household-1',
      week_start_date: '2026-11-09',
      created_by: 'user-1',
    });
    expect(mockBuiltMutations.slice(1).map(({ payload }) => payload)).toEqual([
      expect.objectContaining({
        id: 'entry-id-1',
        meal_plan_id: 'plan-id',
        recipe_id: 'recipe-1',
        entry_date: '2026-11-09',
        meal_slot: 'dinner',
        portions: 2,
      }),
      expect.objectContaining({
        id: 'entry-id-2',
        meal_plan_id: 'plan-id',
        recipe_id: 'recipe-1',
        entry_date: '2026-11-11',
        meal_slot: 'dinner',
        portions: 3,
      }),
    ]);
    expect(result).toEqual({ addedCount: 2, totalCount: 2 });
  });

  it('rejects stale dates, duplicate slots, week crossings, and invalid portions before local writes', async () => {
    const base = mealPlanProposal();
    const firstMeal = base.meals[0];
    const secondMeal = base.meals[1];
    if (!firstMeal || !secondMeal) throw new Error('Test proposal has no meals.');
    const invalidProposals = [
      {
        ...base,
        meals: [{ ...firstMeal, date: '2026-02-30' }],
      },
      {
        ...base,
        meals: [firstMeal, { ...firstMeal, date: '2026-11-09' }],
      },
      {
        ...base,
        meals: [firstMeal, { ...secondMeal, date: '2026-11-16' }],
      },
      {
        ...base,
        meals: [{ ...firstMeal, portions: 0 }],
      },
      {
        ...base,
        meals: [{ ...firstMeal, portions: 13 }],
      },
    ];

    for (const proposal of invalidProposals) {
      await expect(
        applyAssistantMealPlanProposal({
          householdId: 'household-1',
          userId: 'user-1',
          proposal,
        }),
      ).rejects.toEqual(new ApplyMealPlanProposalError('invalid_proposal_snapshot'));
    }

    expect(validateAssistantMealPlanProposal).not.toHaveBeenCalled();
    expect(getDatabase).not.toHaveBeenCalled();
    expect(Outbox.enqueueMutationsInExclusiveTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ['food_rule_coverage_changed', 'food_rule_coverage_changed'],
    ['recipe_changed', 'recipe_changed'],
    ['recipe_evidence_changed', 'recipe_evidence_changed'],
    ['unknown validation reason', 'invalid_proposal_snapshot'],
  ])('maps validation failure %s before opening a transaction', async (reason, expected) => {
    jest.mocked(validateAssistantMealPlanProposal).mockResolvedValue({
      valid: false,
      reason,
    });

    await expect(
      applyAssistantMealPlanProposal({
        householdId: 'household-1',
        userId: 'user-1',
        proposal: mealPlanProposal(),
      }),
    ).rejects.toEqual(
      new ApplyMealPlanProposalError(
        expected as ConstructorParameters<typeof ApplyMealPlanProposalError>[0],
      ),
    );

    expect(getDatabase).not.toHaveBeenCalled();
    expect(Outbox.enqueueMutationsInExclusiveTransaction).not.toHaveBeenCalled();
  });

  it('does not begin a local transaction when current rule evidence is stale', async () => {
    jest.mocked(validateAssistantMealPlanProposal).mockResolvedValue({
      valid: false,
      reason: 'food_rules_changed',
    });

    await expect(
      applyAssistantMealPlanProposal({
        householdId: 'household-1',
        userId: 'user-1',
        proposal: mealPlanProposal(),
      }),
    ).rejects.toEqual(new ApplyMealPlanProposalError('food_rules_changed'));

    expect(getDatabase).not.toHaveBeenCalled();
    expect(Outbox.enqueueMutationsInExclusiveTransaction).not.toHaveBeenCalled();
  });

  it('rejects stale local recipes before creating the plan or any entries', async () => {
    mockGetAllAsync.mockResolvedValueOnce([
      {
        id: 'recipe-1',
        household_id: 'household-1',
        updated_at: Date.parse('2026-11-08T07:30:00.000Z'),
      },
    ]);

    await expect(
      applyAssistantMealPlanProposal({
        householdId: 'household-1',
        userId: 'user-1',
        proposal: mealPlanProposal(),
      }),
    ).rejects.toEqual(new ApplyMealPlanProposalError('recipe_evidence_changed'));

    expect(mockBuiltMutations).toEqual([]);
  });

  it('rejects a recipe from another household before any local write', async () => {
    mockGetAllAsync.mockResolvedValueOnce([
      {
        id: 'recipe-1',
        household_id: 'household-2',
        updated_at: Date.parse('2026-11-08T08:30:00.000Z'),
      },
    ]);

    await expect(
      applyAssistantMealPlanProposal({
        householdId: 'household-1',
        userId: 'user-1',
        proposal: mealPlanProposal(),
      }),
    ).rejects.toEqual(new ApplyMealPlanProposalError('recipe_changed'));

    expect(mockBuiltMutations).toEqual([]);
    expect(mockGetAllAsync).toHaveBeenCalledTimes(1);
  });

  it('rejects occupied meal slots without enqueuing part of the proposal', async () => {
    mockGetAllAsync
      .mockResolvedValueOnce([
        {
          id: 'recipe-1',
          household_id: 'household-1',
          updated_at: Date.parse('2026-11-08T08:30:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          entry_date: '2026-11-09',
          meal_slot: 'dinner',
          recipe_id: 'another-recipe',
          servings_mode: 'portions',
          portions: 2,
          people_count: null,
        },
      ]);

    await expect(
      applyAssistantMealPlanProposal({
        householdId: 'household-1',
        userId: 'user-1',
        proposal: mealPlanProposal(),
      }),
    ).rejects.toEqual(new ApplyMealPlanProposalError('meal_slot_conflict'));

    expect(mockBuiltMutations).toEqual([]);
  });

  it('does not add a second copy when all proposed slots already match', async () => {
    mockGetFirstAsync.mockResolvedValue({
      id: 'plan-existing',
      household_id: 'household-1',
      name: 'Woche 9.–15. Nov.',
      week_start_date: '2026-11-09',
    });
    mockGetAllAsync
      .mockResolvedValueOnce([
        {
          id: 'recipe-1',
          household_id: 'household-1',
          updated_at: Date.parse('2026-11-08T08:30:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          entry_date: '2026-11-09',
          meal_slot: 'dinner',
          recipe_id: 'recipe-1',
          servings_mode: 'portions',
          portions: 2,
          people_count: null,
        },
        {
          entry_date: '2026-11-11',
          meal_slot: 'dinner',
          recipe_id: 'recipe-1',
          servings_mode: 'portions',
          portions: 3,
          people_count: null,
        },
      ]);

    const result = await applyAssistantMealPlanProposal({
      householdId: 'household-1',
      userId: 'user-1',
      proposal: mealPlanProposal(),
    });

    expect(mockBuiltMutations).toEqual([]);
    expect(result).toEqual({ addedCount: 0, totalCount: 2 });
  });
});
