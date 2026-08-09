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
import { useHouseholds } from '@/features/household/api';
import type { Database } from '@/lib/database.types';
import { getStoredActiveHouseholdId, setStoredActiveHouseholdId } from './active-household-store';

type Household = Database['public']['Tables']['households']['Row'];

interface ActiveHouseholdContextType {
  activeHouseholdId: string | null;
  activeHousehold: Household | null;
  households: Household[];
  isLoading: boolean;
  setActiveHouseholdId: (id: string) => Promise<void>;
}

const ActiveHouseholdContext = createContext<ActiveHouseholdContextType | undefined>(undefined);

export function ActiveHouseholdProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const { data: households = [], isLoading, isFetching } = useHouseholds();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isStoreLoaded, setIsStoreLoaded] = useState(false);

  useEffect(() => {
    getStoredActiveHouseholdId().then((storedId) => {
      if (storedId) {
        setSelectedId(storedId);
      }
      setIsStoreLoaded(true);
    });
  }, []);

  /**
   * Verwirft die Auswahl, sobald ein anderer Nutzer angemeldet ist.
   *
   * Dieser Provider haengt im Root-Layout und wird bei An- und Abmeldung nie
   * neu gemountet — `selectedId` wuerde also den Nutzerwechsel ueberleben. Bis
   * der Fix an `useHouseholds()` griff, war das eine der Stellen, ueber die der
   * Haushalt des Vornutzers beim neuen Nutzer wieder auftauchte.
   *
   * Bewusst nur bei einem Wechsel *weg von* einer bekannten Nutzer-Id: Der
   * Uebergang `null → userId` ist der normale Kaltstart, und dort darf die
   * gerade aus dem Speicher gelesene Auswahl nicht weggeworfen werden.
   */
  const previousUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const previousUserId = previousUserIdRef.current;
    previousUserIdRef.current = userId;

    if (previousUserId === null || previousUserId === userId) return;

    setSelectedId(null);
    setStoredActiveHouseholdId(null);
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

  // Wenn Fallback eingetreten ist oder die Speicherung nicht mit dem aktiven Haushalt übereinstimmt, aktualisieren
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
      isLoading: isLoading || isFetching || !isStoreLoaded,
      setActiveHouseholdId: handleSetActiveHouseholdId,
    }),
    [
      activeHouseholdId,
      activeHousehold,
      households,
      isLoading,
      isFetching,
      isStoreLoaded,
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
