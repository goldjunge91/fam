import { getDatabase } from '@/lib/db/local-client';
import type { SqlDatabase } from '@/lib/db/types';
import type { AssistantProposal } from '../types';
import {
  ApplyIngredientSwapProposalError,
  applyAssistantIngredientSwapProposal,
} from './apply-ingredient-swap-proposal';
import { validateAssistantRecipeProposal } from './assistant-api';

const mockGetFirstAsync = jest.fn();
const mockEnqueueMutation = jest.fn();
const mockApplyLocalMirrorWrite = jest.fn();
const mockTxn = {} as SqlDatabase;

jest.mock('@/lib/db/local-client', () => ({ getDatabase: jest.fn() }));
jest.mock('@/lib/db/outbox', () => ({
  enqueueMutation: (...args: unknown[]) => mockEnqueueMutation(...args),
}));
jest.mock('@/lib/sync/mirror-write', () => ({
  applyLocalMirrorWrite: (...args: unknown[]) => mockApplyLocalMirrorWrite(...args),
}));
jest.mock('./assistant-api', () => ({ validateAssistantRecipeProposal: jest.fn() }));

type SwapProposal = Extract<AssistantProposal, { kind: 'ingredient_swap_proposal.v1' }>;

function coverage(): NonNullable<SwapProposal['foodRuleCoverage']> {
  return {
    status: 'clear',
    rulesUpdatedAt: '2026-11-08T09:00:00.000Z',
    recipeVersions: [
      {
        recipeId: 'recipe-1',
        recipeUpdatedAt: '2026-11-08T08:30:00.000Z',
        coverageVersion: 'reviewed-evidence-v1',
      },
    ],
  };
}

function proposal(overrides: Partial<SwapProposal> = {}): SwapProposal {
  return {
    kind: 'ingredient_swap_proposal.v1',
    foodRulesUpdatedAt: '2026-11-08T09:00:00.000Z',
    foodRuleCoverage: coverage(),
    recipeId: 'recipe-1',
    recipeTitle: 'Linsensuppe',
    ingredientItemId: 'ingredient-1',
    ingredientName: 'Butter',
    replacement: 'Olivenöl',
    rationale: 'Pflanzliche Alternative',
    safetyNote: 'Allergene wurden geprüft.',
    ...overrides,
  };
}

function malformedProposal(overrides: Record<string, unknown>): SwapProposal {
  return { ...proposal(), ...overrides } as unknown as SwapProposal;
}

function recipeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'recipe-1',
    household_id: 'household-1',
    updated_at: '2026-11-08T08:30:00.000Z',
    substitutions: '[]',
    ...overrides,
  };
}

describe('applyAssistantIngredientSwapProposal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getDatabase).mockResolvedValue({ getFirstAsync: mockGetFirstAsync } as never);
    mockGetFirstAsync.mockResolvedValue(recipeRow());
    jest.mocked(validateAssistantRecipeProposal).mockResolvedValue({ valid: true });
    mockEnqueueMutation.mockImplementation(async (_db, input) => input.applyLocally(mockTxn));
  });

  it('validates current evidence and replaces one matching substitution through the recipe outbox', async () => {
    mockGetFirstAsync.mockResolvedValue(
      recipeRow({
        substitutions: JSON.stringify([
          { forIngredientId: 'ingredient-1', swap: 'Margarine' },
          { forIngredientId: 'another-ingredient', swap: 'Tofu' },
        ]),
      }),
    );

    await expect(
      applyAssistantIngredientSwapProposal({ householdId: 'household-1', proposal: proposal() }),
    ).resolves.toEqual({ changed: true });

    expect(validateAssistantRecipeProposal).toHaveBeenCalledWith({
      householdId: 'household-1',
      proposal: proposal(),
    });
    expect(mockEnqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'recipes',
        entityId: 'recipe-1',
        op: 'update',
        payload: expect.objectContaining({
          household_id: 'household-1',
          substitutions: [
            { forIngredientId: 'another-ingredient', swap: 'Tofu' },
            { forIngredientId: 'ingredient-1', swap: 'Olivenöl' },
          ],
        }),
      }),
    );
    expect(mockApplyLocalMirrorWrite).toHaveBeenCalledWith(
      mockTxn,
      'recipes',
      'update',
      { id: 'recipe-1', substitutions: expect.any(Array) },
      expect.any(Number),
    );
  });

  it('uses the ingredient name when no item id exists and skips an identical substitution', async () => {
    mockGetFirstAsync.mockResolvedValue(
      recipeRow({
        substitutions: JSON.stringify([{ forIngredientId: 'Butter', swap: 'Olivenöl' }]),
      }),
    );
    await expect(
      applyAssistantIngredientSwapProposal({
        householdId: 'household-1',
        proposal: proposal({ ingredientItemId: undefined }),
      }),
    ).resolves.toEqual({ changed: false });
    expect(mockEnqueueMutation).not.toHaveBeenCalled();
  });

  it.each([
    ['not clear', malformedProposal({ foodRuleCoverage: { ...coverage(), status: 'unknown' } })],
    ['rule version mismatch', malformedProposal({ foodRulesUpdatedAt: 'stale' })],
    ['no version', malformedProposal({ foodRuleCoverage: { ...coverage(), recipeVersions: [] } })],
    [
      'wrong recipe version',
      malformedProposal({
        foodRuleCoverage: {
          ...coverage(),
          recipeVersions: coverage().recipeVersions.map((version) => ({
            ...version,
            recipeId: 'other',
          })),
        },
      }),
    ],
    ['blank recipe', malformedProposal({ recipeId: ' ' })],
    ['blank ingredient', malformedProposal({ ingredientName: ' ' })],
    ['blank replacement', malformedProposal({ replacement: ' ' })],
  ])('rejects an invalid proposal snapshot (%s)', async (_description, invalidProposal) => {
    await expect(
      applyAssistantIngredientSwapProposal({
        householdId: 'household-1',
        proposal: invalidProposal,
      }),
    ).rejects.toEqual(new ApplyIngredientSwapProposalError('invalid_proposal_snapshot'));
    expect(validateAssistantRecipeProposal).not.toHaveBeenCalled();
    expect(getDatabase).not.toHaveBeenCalled();
  });

  it.each([
    ['food_rules_changed', 'food_rules_changed'],
    ['food_rule_coverage_changed', 'food_rule_coverage_changed'],
    ['recipe_changed', 'recipe_changed'],
    ['recipe_evidence_changed', 'recipe_evidence_changed'],
    ['unknown', 'invalid_proposal_snapshot'],
  ])('maps stale gateway evidence (%s) before local writes', async (reason, expected) => {
    jest.mocked(validateAssistantRecipeProposal).mockResolvedValue({ valid: false, reason });
    await expect(
      applyAssistantIngredientSwapProposal({ householdId: 'household-1', proposal: proposal() }),
    ).rejects.toEqual(new ApplyIngredientSwapProposalError(expected as never));
    expect(getDatabase).not.toHaveBeenCalled();
  });

  it('rejects missing, mismatched, and stale local recipe rows', async () => {
    for (const row of [null, recipeRow({ household_id: 'other-household' })]) {
      mockGetFirstAsync.mockResolvedValueOnce(row);
      await expect(
        applyAssistantIngredientSwapProposal({ householdId: 'household-1', proposal: proposal() }),
      ).rejects.toEqual(new ApplyIngredientSwapProposalError('recipe_changed'));
    }

    mockGetFirstAsync.mockResolvedValueOnce(recipeRow({ updated_at: 'not-a-date' }));
    await expect(
      applyAssistantIngredientSwapProposal({ householdId: 'household-1', proposal: proposal() }),
    ).rejects.toEqual(new ApplyIngredientSwapProposalError('recipe_evidence_changed'));

    mockGetFirstAsync.mockResolvedValueOnce(recipeRow({ updated_at: '2026-11-08T07:30:00.000Z' }));
    await expect(
      applyAssistantIngredientSwapProposal({ householdId: 'household-1', proposal: proposal() }),
    ).rejects.toEqual(new ApplyIngredientSwapProposalError('recipe_evidence_changed'));
    expect(mockEnqueueMutation).not.toHaveBeenCalled();
  });

  it('accepts numeric local timestamps and defaults malformed substitution JSON to an empty list', async () => {
    mockGetFirstAsync.mockResolvedValue(
      recipeRow({
        updated_at: Date.parse('2026-11-08T08:30:00.000Z'),
        substitutions: 'not json',
      }),
    );
    await expect(
      applyAssistantIngredientSwapProposal({
        householdId: 'household-1',
        proposal: proposal({ ingredientItemId: undefined }),
      }),
    ).resolves.toEqual({ changed: true });
    const mutation = mockEnqueueMutation.mock.calls[0]?.[1];
    expect(mutation?.payload.substitutions).toEqual([
      { forIngredientId: 'Butter', swap: 'Olivenöl' },
    ]);
  });
});
