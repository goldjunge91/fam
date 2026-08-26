import { useEffect, useState } from 'react';

import { registerLocalAccountCache } from '@/features/auth/local-account-cache';
import { useSession } from '@/features/auth/session-provider';
import {
  listFavoriteRecipeKeys,
  toggleStoredRecipeFavorite,
} from './recipe-preferences-repository';

export type RecipeFavoriteKey = `recipe:${string}` | `template:${string}`;

type AccountFavorites = {
  cache: Set<RecipeFavoriteKey> | null;
  loading: Promise<Set<RecipeFavoriteKey>> | null;
  listeners: Set<(favorites: ReadonlySet<RecipeFavoriteKey>) => void>;
};

const accountFavorites = new Map<string, AccountFavorites>();

function stateFor(userId: string): AccountFavorites {
  const existing = accountFavorites.get(userId);
  if (existing) return existing;
  const created: AccountFavorites = { cache: null, loading: null, listeners: new Set() };
  accountFavorites.set(userId, created);
  return created;
}

function isFavoriteKey(value: string): value is RecipeFavoriteKey {
  return value.startsWith('recipe:') || value.startsWith('template:');
}

async function loadFavorites(userId: string): Promise<Set<RecipeFavoriteKey>> {
  const state = stateFor(userId);
  if (state.cache) return state.cache;
  if (state.loading) return state.loading;

  state.loading = listFavoriteRecipeKeys(userId)
    .then((keys) => {
      state.cache = new Set(keys.filter(isFavoriteKey));
      return state.cache;
    })
    .finally(() => {
      state.loading = null;
    });
  return state.loading;
}

/** Entfernt entschlüsselte Favoriten dieses Accounts aus dem Modulcache. */
export function resetRecipeFavoritesCache(userId: string): void {
  accountFavorites.delete(userId);
}

registerLocalAccountCache('recipe-favorites', resetRecipeFavoritesCache);

async function toggleFavorite(userId: string, key: RecipeFavoriteKey): Promise<void> {
  const favorite = await toggleStoredRecipeFavorite(userId, key);
  const state = stateFor(userId);
  const favorites = state.cache ?? (await loadFavorites(userId));
  if (favorite) favorites.add(key);
  else favorites.delete(key);
  for (const listener of state.listeners) listener(new Set(favorites));
}

/** Lokal persistente, strikt pro Nutzer getrennte Favoriten. */
export function useRecipeFavorites() {
  const { session } = useSession();
  const userId = session?.user.id;
  const [favorites, setFavorites] = useState<ReadonlySet<RecipeFavoriteKey>>(() => new Set());

  useEffect(() => {
    // Direkte Account-Wechsel dürfen während des asynchronen Ladens nicht den
    // Satz des vorherigen Nutzers anzeigen.
    setFavorites(new Set());
    if (!userId) {
      return;
    }

    let active = true;
    const state = stateFor(userId);
    const listener = (next: ReadonlySet<RecipeFavoriteKey>) => {
      if (active) setFavorites(next);
    };
    state.listeners.add(listener);
    void loadFavorites(userId)
      .then((loaded) => listener(new Set(loaded)))
      .catch(() => {
        // Ein Logout darf den laufenden DB-Read durch das Lifecycle-Gate
        // abbrechen. Der bereits geleerte Hook-State bleibt autoritativ.
      });
    return () => {
      active = false;
      state.listeners.delete(listener);
      // Beim Logout/Nutzerwechsel darf kein entschlüsselter Favoritensatz im
      // Prozesscache verbleiben. Der letzte aktive Consumer räumt ihn auf.
      if (state.listeners.size === 0) accountFavorites.delete(userId);
    };
  }, [userId]);

  return {
    favorites,
    isFavorite: (key: RecipeFavoriteKey) => favorites.has(key),
    toggleFavorite: (key: RecipeFavoriteKey) =>
      userId ? toggleFavorite(userId, key) : Promise.resolve(),
  };
}
