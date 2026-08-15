import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export type RecipeRating = {
  score: number;
  note: string;
  updatedAt: string;
};

const STORAGE_KEY = 'fam.recipe-ratings.v1';
const listeners = new Map<string, Set<(rating: RecipeRating | null) => void>>();

function notify(recipeId: string, rating: RecipeRating) {
  for (const listener of listeners.get(recipeId) ?? []) listener(rating);
}

async function readRatings(): Promise<Record<string, RecipeRating>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, RecipeRating>) : {};
  } catch {
    return {};
  }
}

export async function getRecipeRating(recipeId: string): Promise<RecipeRating | null> {
  const ratings = await readRatings();
  const rating = ratings[recipeId];
  if (!rating || rating.score < 1 || rating.score > 10) return null;
  return rating;
}

export async function saveRecipeRating(
  recipeId: string,
  score: number,
  note: string,
): Promise<RecipeRating> {
  const ratings = await readRatings();
  const rating = {
    score: Math.max(1, Math.min(10, Math.round(score))),
    note: note.trim(),
    updatedAt: new Date().toISOString(),
  };
  ratings[recipeId] = rating;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ratings));
  notify(recipeId, rating);
  return rating;
}

/** Liefert die lokal gespeicherte Bewertung und aktualisiert sie nach erneutem Bewerten live. */
export function useRecipeRating(recipeId: string) {
  const [rating, setRating] = useState<RecipeRating | null>(null);

  useEffect(() => {
    let active = true;
    const listener = (next: RecipeRating | null) => {
      if (active) setRating(next);
    };
    const recipeListeners =
      listeners.get(recipeId) ?? new Set<(rating: RecipeRating | null) => void>();
    recipeListeners.add(listener);
    listeners.set(recipeId, recipeListeners);
    getRecipeRating(recipeId).then(listener);
    return () => {
      active = false;
      recipeListeners.delete(listener);
      if (recipeListeners.size === 0) listeners.delete(recipeId);
    };
  }, [recipeId]);

  return rating;
}
