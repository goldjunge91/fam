import { and, eq, isNull } from 'drizzle-orm';

import { getDrizzleDatabase } from '@/lib/db/client';
import { recipes } from '@/lib/db/schemas';
import type { RecipeCandidate, RecipeIngredient } from '../domain/recipe-candidates';

export type RecipeCatalogRow = {
  id: string;
  householdId: string;
  title: string;
  cookTimeMinutes: number | null;
  defaultServings: number | null;
  dietaryTags: string | null;
  ingredients?: readonly RecipeIngredient[];
};

function parseTags(serializedTags: string | null): string[] {
  if (!serializedTags) return [];

  try {
    const parsed: unknown = JSON.parse(serializedTags);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function normalizeServings(value: number | null): number | null {
  return value !== null && Number.isInteger(value) && value > 0 ? value : null;
}

export function mapRecipeRowsToCandidates(rows: readonly RecipeCatalogRow[]): RecipeCandidate[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title.trim(),
    cookTimeMinutes: row.cookTimeMinutes,
    defaultServings: normalizeServings(row.defaultServings),
    dietaryTags: parseTags(row.dietaryTags),
    // The current local schema has no authoritative allergen column.
    allergens: null,
    ingredients: row.ingredients ?? [],
  }));
}

function requireHouseholdId(householdId: string): string {
  const normalized = householdId.trim();
  if (!normalized) throw new Error('Die Rezeptbasis benötigt eine household_id.');
  return normalized;
}

/** Reads active recipes for one household; this adapter has no write path. */
export async function readRecipeCandidates(householdId: string): Promise<RecipeCandidate[]> {
  const normalizedHouseholdId = requireHouseholdId(householdId);
  const db = await getDrizzleDatabase();
  const rows = await db
    .select({
      id: recipes.id,
      householdId: recipes.householdId,
      title: recipes.title,
      cookTimeMinutes: recipes.cookTimeMinutes,
      defaultServings: recipes.defaultServings,
      dietaryTags: recipes.dietaryTags,
    })
    .from(recipes)
    .where(and(eq(recipes.householdId, normalizedHouseholdId), isNull(recipes.deletedAt)));

  return mapRecipeRowsToCandidates(rows);
}
