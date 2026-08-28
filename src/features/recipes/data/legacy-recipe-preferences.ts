import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecipeFavoriteKey } from '../domain/recipe-favorites';
import { setStoredRecipeFavorite, writeStoredRecipeRating } from './recipe-preferences-repository';

const LEGACY_FAVORITES_KEY = 'fam.recipe-favorites.v1';
const LEGACY_RATINGS_KEY = 'fam.recipe-ratings.v1';
const LEGACY_FAVORITES_MARKER = '@fam/migrations/recipe-favorites-v1';
const LEGACY_RATINGS_MARKER = '@fam/migrations/recipe-ratings-v1';

function isFavoriteKey(value: unknown): value is RecipeFavoriteKey {
  return (
    typeof value === 'string' &&
    (value.startsWith('recipe:') || value.startsWith('template:') || value.startsWith('catalog:'))
  );
}

function parseFavorites(raw: string | null): RecipeFavoriteKey[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isFavoriteKey) : [];
  } catch {
    return [];
  }
}

type LegacyRating = {
  score: number;
  note: string;
  updatedAt: number;
};

function parseRatings(raw: string | null): Array<[string, LegacyRating]> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];

    const ratings: Array<[string, LegacyRating]> = [];
    for (const [legacyRecipeId, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      const candidate = value as Record<string, unknown>;
      if (
        typeof candidate.score !== 'number' ||
        !Number.isInteger(candidate.score) ||
        candidate.score < 1 ||
        candidate.score > 10
      ) {
        continue;
      }

      const parsedUpdatedAt =
        typeof candidate.updatedAt === 'string' ? Date.parse(candidate.updatedAt) : Number.NaN;
      ratings.push([
        legacyRecipeId.startsWith('recipe:') ? legacyRecipeId : `recipe:${legacyRecipeId}`,
        {
          score: candidate.score,
          note: typeof candidate.note === 'string' ? candidate.note : '',
          updatedAt: Number.isFinite(parsedUpdatedAt) ? parsedUpdatedAt : Date.now(),
        },
      ]);
    }
    return ratings;
  } catch {
    return [];
  }
}

async function migrateFavorites(restoredUserId: string | null): Promise<void> {
  if (await AsyncStorage.getItem(LEGACY_FAVORITES_MARKER)) {
    await AsyncStorage.removeItem(LEGACY_FAVORITES_KEY);
    return;
  }

  const raw = await AsyncStorage.getItem(LEGACY_FAVORITES_KEY);
  if (restoredUserId) {
    for (const recipeKey of parseFavorites(raw)) {
      await setStoredRecipeFavorite(restoredUserId, recipeKey, true);
    }
  }

  await AsyncStorage.removeItem(LEGACY_FAVORITES_KEY);
  await AsyncStorage.setItem(LEGACY_FAVORITES_MARKER, 'done');
}

async function migrateRatings(restoredUserId: string | null): Promise<void> {
  if (await AsyncStorage.getItem(LEGACY_RATINGS_MARKER)) {
    await AsyncStorage.removeItem(LEGACY_RATINGS_KEY);
    return;
  }

  const raw = await AsyncStorage.getItem(LEGACY_RATINGS_KEY);
  if (restoredUserId) {
    for (const [recipeKey, rating] of parseRatings(raw)) {
      await writeStoredRecipeRating(
        restoredUserId,
        recipeKey,
        rating.score,
        rating.note,
        rating.updatedAt,
      );
    }
  }

  await AsyncStorage.removeItem(LEGACY_RATINGS_KEY);
  await AsyncStorage.setItem(LEGACY_RATINGS_MARKER, 'done');
}

export async function migrateLegacyRecipePreferences(restoredUserId: string | null): Promise<void> {
  const results = await Promise.allSettled([
    migrateFavorites(restoredUserId),
    migrateRatings(restoredUserId),
  ]);
  const failedMigration = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failedMigration) {
    throw new Error('Mindestens eine Legacy-Rezeptmigration ist fehlgeschlagen.', {
      cause: failedMigration.reason,
    });
  }
}
