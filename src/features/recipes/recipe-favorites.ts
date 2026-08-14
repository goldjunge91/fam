import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export type RecipeFavoriteKey = `recipe:${string}` | `template:${string}`;

const STORAGE_KEY = 'fam.recipe-favorites.v1';
const listeners = new Set<(favorites: ReadonlySet<RecipeFavoriteKey>) => void>();
let cache: Set<RecipeFavoriteKey> | null = null;
let loading: Promise<Set<RecipeFavoriteKey>> | null = null;

function notify() {
  if (!cache) return;
  for (const listener of listeners) listener(new Set(cache));
}

async function loadFavorites(): Promise<Set<RecipeFavoriteKey>> {
  if (cache) return cache;
  if (loading) return loading;

  loading = AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      let values: unknown = [];
      try {
        values = raw ? (JSON.parse(raw) as unknown) : [];
      } catch {
        values = [];
      }
      cache = new Set(
        Array.isArray(values)
          ? values.filter(
              (value): value is RecipeFavoriteKey =>
                typeof value === 'string' &&
                (value.startsWith('recipe:') || value.startsWith('template:')),
            )
          : [],
      );
      return cache;
    })
    .catch(() => {
      cache = new Set();
      return cache;
    })
    .finally(() => {
      loading = null;
    });

  return loading;
}

async function toggleFavorite(key: RecipeFavoriteKey) {
  const favorites = await loadFavorites();
  if (favorites.has(key)) favorites.delete(key);
  else favorites.add(key);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]));
  notify();
}

/** Lokal persistente Favoriten, entkoppelt von Rezept- und Template-Datenquellen. */
export function useRecipeFavorites() {
  const [favorites, setFavorites] = useState<ReadonlySet<RecipeFavoriteKey>>(
    () => new Set(cache ?? []),
  );

  useEffect(() => {
    let active = true;
    const listener = (next: ReadonlySet<RecipeFavoriteKey>) => {
      if (active) setFavorites(next);
    };
    listeners.add(listener);
    loadFavorites().then((loaded) => listener(new Set(loaded)));
    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, []);

  return {
    favorites,
    isFavorite: (key: RecipeFavoriteKey) => favorites.has(key),
    toggleFavorite,
  };
}
