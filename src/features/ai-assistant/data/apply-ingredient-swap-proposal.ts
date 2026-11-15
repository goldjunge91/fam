import type { RecipeSubstitution } from '@/features/recipes/hooks/use-recipes';
import { parseJsonArray } from '@/lib/db/json-array';
import { getDatabase } from '@/lib/db/local-client';
import { enqueueMutation } from '@/lib/db/outbox';
import { toEpochMs } from '@/lib/sync/cursor';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';
import type { AssistantProposal } from '../types';
import { validateAssistantRecipeProposal } from './assistant-api';

type IngredientSwapProposal = Extract<AssistantProposal, { kind: 'ingredient_swap_proposal.v1' }>;

type ApplyIngredientSwapErrorCode =
  | 'invalid_proposal_snapshot'
  | 'food_rules_changed'
  | 'food_rule_coverage_changed'
  | 'recipe_changed'
  | 'recipe_evidence_changed';

export class ApplyIngredientSwapProposalError extends Error {
  constructor(readonly code: ApplyIngredientSwapErrorCode) {
    super(code);
    this.name = 'ApplyIngredientSwapProposalError';
  }
}

function fail(code: ApplyIngredientSwapErrorCode): never {
  throw new ApplyIngredientSwapProposalError(code);
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

function assertProposal(proposal: IngredientSwapProposal) {
  const coverage = proposal.foodRuleCoverage;
  const version = coverage?.recipeVersions[0];
  if (
    coverage?.status !== 'clear' ||
    coverage.rulesUpdatedAt !== proposal.foodRulesUpdatedAt ||
    coverage.recipeVersions.length !== 1 ||
    !version ||
    version.recipeId !== proposal.recipeId ||
    !version.recipeUpdatedAt ||
    !version.coverageVersion ||
    !proposal.recipeId.trim() ||
    !proposal.ingredientName.trim() ||
    !proposal.replacement.trim()
  ) {
    fail('invalid_proposal_snapshot');
  }
  return version;
}

/** Revalidates recipe evidence and stores the swap in the existing recipe outbox path. */
export async function applyAssistantIngredientSwapProposal(input: {
  householdId: string;
  proposal: IngredientSwapProposal;
}): Promise<{ changed: boolean }> {
  const expectedVersion = assertProposal(input.proposal);
  const validation = await validateAssistantRecipeProposal(input);
  if (!validation.valid) {
    if (validation.reason === 'food_rules_changed') fail('food_rules_changed');
    if (validation.reason === 'food_rule_coverage_changed') fail('food_rule_coverage_changed');
    if (validation.reason === 'recipe_changed') fail('recipe_changed');
    if (validation.reason === 'recipe_evidence_changed') fail('recipe_evidence_changed');
    fail('invalid_proposal_snapshot');
  }

  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    id: string;
    household_id: string;
    updated_at: number | string;
    substitutions: string;
  }>(
    `select id, household_id, updated_at, substitutions
     from recipes
     where id = ? and household_id = ? and deleted_at is null
     limit 1`,
    [input.proposal.recipeId, input.householdId],
  );
  if (!row || row.household_id !== input.householdId) fail('recipe_changed');
  if (localTimestampMs(row.updated_at) !== toEpochMs(expectedVersion.recipeUpdatedAt)) {
    fail('recipe_evidence_changed');
  }

  const substitutions = parseJsonArray<RecipeSubstitution>(row.substitutions);
  const forIngredientId = input.proposal.ingredientItemId ?? input.proposal.ingredientName.trim();
  const nextSubstitution: RecipeSubstitution = {
    forIngredientId,
    swap: input.proposal.replacement.trim(),
  };
  const existing = substitutions.find((item) => item.forIngredientId === forIngredientId);
  if (existing?.swap === nextSubstitution.swap) return { changed: false };

  const nextSubstitutions = [
    ...substitutions.filter((item) => item.forIngredientId !== forIngredientId),
    nextSubstitution,
  ];
  const updatedAt = new Date().toISOString();
  await enqueueMutation(db, {
    entity: 'recipes',
    entityId: row.id,
    op: 'update',
    payload: {
      id: row.id,
      household_id: input.householdId,
      substitutions: nextSubstitutions,
      updated_at: updatedAt,
    },
    applyLocally: (txn) =>
      applyLocalMirrorWrite(
        txn,
        'recipes',
        'update',
        { id: row.id, substitutions: nextSubstitutions },
        Date.parse(updatedAt),
      ),
  });

  return { changed: true };
}
