import { useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useSession } from '@/features/auth/session-provider';
import { type Household, useHouseholds } from '@/features/household/api';
import { useHouseholdsBootstrapSync } from '@/lib/sync/household-bootstrap-sync';
import { getStoredActiveHouseholdId, setStoredActiveHouseholdId } from './active-household-store';

interface ActiveHouseholdContextType {
  activeHouseholdId: string | null;
  activeHousehold: Household | null;
  households: Household[];
  isLoading: boolean;
  /** Der Haushalts-Request ist fehlgeschlagen — siehe Kommentar in `app-entry.ts`. */
  isError: boolean;
  setActiveHouseholdId: (id: string) => Promise<void>;
}

const ActiveHouseholdContext = createContext<ActiveHouseholdContextType | undefined>(undefined);

export function ActiveHouseholdProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();
  const { data: households = [], isLoading, isError } = useHouseholds();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isStoreLoaded, setIsStoreLoaded] = useState(false);

  // Hält den lokalen Haushaltsspiegel über Pull, Poll und Reconnect aktuell.
  useHouseholdsBootstrapSync(userId ?? undefined, queryClient);

  useEffect(() => {
    getStoredActiveHouseholdId().then((storedId) => {
      if (storedId) {
        setSelectedId(storedId);
      }
      setIsStoreLoaded(true);
    });
  }, []);

  const previousUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const previousUserId = previousUserIdRef.current;
    previousUserIdRef.current = userId;

    if (previousUserId === null || previousUserId === userId) return;

    setSelectedId(null);
  }, [userId]);

  // Wähle den aktiven Haushalt aus der geladenen Liste (mit Fallback auf den ersten)
  const activeHousehold = useMemo(() => {
    if (!households || households.length === 0) return null;
    if (selectedId) {
      const found = households.find((h) => h.id === selectedId);
      if (found) return found;
    }
    return households[0] ?? null;
  }, [households, selectedId]);

  const activeHouseholdId = activeHousehold?.id ?? null;

  useEffect(() => {
    if (isStoreLoaded && activeHouseholdId && activeHouseholdId !== selectedId) {
      setSelectedId(activeHouseholdId);
      setStoredActiveHouseholdId(activeHouseholdId);
    }
  }, [isStoreLoaded, activeHouseholdId, selectedId]);

  const handleSetActiveHouseholdId = useCallback(async (id: string) => {
    setSelectedId(id);
    await setStoredActiveHouseholdId(id);
  }, []);

  const value = useMemo(
    () => ({
      activeHouseholdId,
      activeHousehold,
      households,
      // Hintergrund-Refetches dürfen den aktiven Screen nicht als Ladezustand behandeln.
      isLoading: isLoading || !isStoreLoaded,
      isError,
      setActiveHouseholdId: handleSetActiveHouseholdId,
    }),
    [
      activeHouseholdId,
      activeHousehold,
      households,
      isLoading,
      isStoreLoaded,
      isError,
      handleSetActiveHouseholdId,
    ],
  );

  return (
    <ActiveHouseholdContext.Provider value={value}>{children}</ActiveHouseholdContext.Provider>
  );
}

export function useActiveHousehold() {
  const context = useContext(ActiveHouseholdContext);
  if (!context) {
    throw new Error(
      'useActiveHousehold muss innerhalb von ActiveHouseholdProvider verwendet werden',
    );
  }
  return context;
}

/**
 * Optionale Variante fuer wiederverwendbare UI-Bausteine, die auch isoliert
 * getestet oder ausserhalb des Haushaltsflows gerendert werden koennen.
 */
export function useOptionalActiveHousehold() {
  return useContext(ActiveHouseholdContext) ?? null;
}
