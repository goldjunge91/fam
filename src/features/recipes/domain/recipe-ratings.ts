import { useEffect, useState } from 'react';
import { useSession } from '@/features/auth/session-provider';
import { registerLocalAccountCache } from '@/lib/storage/account-cache-registry';
import {
  readStoredRecipeRating,
  writeStoredRecipeRating,
} from '../data/recipe-preferences-repository';

export type RecipeRating = {
  score: number;
  note: string;
  updatedAt: string;
};

const listeners = new Map<string, Set<(rating: RecipeRating | null) => void>>();

function listenerKey(userId: string, recipeId: string): string {
  return `${userId}:${recipeId}`;
}

function toRecipeRating(
  stored: Awaited<ReturnType<typeof readStoredRecipeRating>>,
): RecipeRating | null {
  if (!stored) return null;
  return {
    score: stored.score,
    note: stored.note,
    updatedAt: new Date(stored.updatedAt).toISOString(),
  };
}

export async function getRecipeRating(
  userId: string,
  recipeId: string,
): Promise<RecipeRating | null> {
  return toRecipeRating(await readStoredRecipeRating(userId, `recipe:${recipeId}`));
}

export async function saveRecipeRating(
  userId: string,
  recipeId: string,
  score: number,
  note: string,
): Promise<RecipeRating> {
  const normalizedScore = Math.max(1, Math.min(10, Math.round(score)));
  const stored = await writeStoredRecipeRating(
    userId,
    `recipe:${recipeId}`,
    normalizedScore,
    note.trim(),
  );
  const rating = toRecipeRating(stored);
  if (!rating) throw new Error('Die Rezeptbewertung konnte nicht gespeichert werden.');
  for (const listener of listeners.get(listenerKey(userId, recipeId)) ?? []) listener(rating);
  return rating;
}

/** Liefert nur die Bewertung des aktuell angemeldeten Nutzers. */
export function useRecipeRating(recipeId: string) {
  const { session } = useSession();
  const userId = session?.user.id;
  const [rating, setRating] = useState<RecipeRating | null>(null);

  useEffect(() => {
    // Kein kurzes Anzeigen der Bewertung des vorigen Accounts, während die
    // neue nutzerspezifische Zeile geladen wird.
    setRating(null);
    if (!userId) {
      return;
    }

    let active = true;
    const key = listenerKey(userId, recipeId);
    const listener = (next: RecipeRating | null) => {
      if (active) setRating(next);
    };
    const recipeListeners = listeners.get(key) ?? new Set<(rating: RecipeRating | null) => void>();
    recipeListeners.add(listener);
    listeners.set(key, recipeListeners);
    void getRecipeRating(userId, recipeId)
      .then(listener)
      .catch(() => {
        // Ein Logout darf den laufenden DB-Read durch das Lifecycle-Gate
        // abbrechen. Der bereits geleerte Hook-State bleibt autoritativ.
      });
    return () => {
      active = false;
      recipeListeners.delete(listener);
      if (recipeListeners.size === 0) listeners.delete(key);
    };
  }, [recipeId, userId]);

  return rating;
}

/** Entfernt Listener dieses Accounts aus dem Modulcache. */
export function resetRecipeRatingsCache(userId: string): void {
  const prefix = `${userId}:`;
  for (const key of listeners.keys()) {
    if (key.startsWith(prefix)) listeners.delete(key);
  }
}

registerLocalAccountCache('recipe-ratings', resetRecipeRatingsCache);
