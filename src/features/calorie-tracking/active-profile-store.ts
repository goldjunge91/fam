import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo } from 'react';
import { create } from 'zustand';

import { useSession } from '@/features/auth/session-provider';
import { getSupabase } from '@/lib/supabase';

export type ActiveProfile =
  | { type: 'adult'; userId: string }
  | { type: 'child'; childProfileId: string; householdId: string };

// Nutzer- *und* haushaltsgebunden, damit ein Kontowechsel auf demselben Geraet
// nie die Kind-Auswahl eines anderen Nutzers im selben Haushalt sieht.
function storageKey(userId: string, householdId: string): string {
  return `@fam/active_child_profile_id/${userId}/${householdId}`;
}

export async function getStoredActiveChildProfileId(
  userId: string,
  householdId: string,
): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(storageKey(userId, householdId));
  } catch {
    return null;
  }
}

export async function setStoredActiveChildProfileId(
  userId: string,
  householdId: string,
  childProfileId: string | null,
): Promise<void> {
  try {
    if (childProfileId) {
      await AsyncStorage.setItem(storageKey(userId, householdId), childProfileId);
    } else {
      await AsyncStorage.removeItem(storageKey(userId, householdId));
    }
  } catch {
    // Stiller Fallback, wie active-household-store.ts.
  }
}

async function childProfileExists(householdId: string, childProfileId: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('child_profiles')
    .select('id')
    .eq('id', childProfileId)
    .eq('household_id', householdId)
    .maybeSingle();

  if (error) {
    // Bei einem Netzwerk-/Serverfehler nicht blind auf "ungueltig" schliessen —
    // sonst wirft ein voruebergehender Fehler den Nutzer staendig aufs
    // Erwachsenen-Profil zurueck. Im Zweifel die gespeicherte Auswahl behalten.
    return true;
  }
  return data != null;
}

function cacheKey(userId: string, householdId: string): string {
  return `${userId}:${householdId}`;
}

interface ActiveProfileStore {
  profilesByKey: Record<string, ActiveProfile>;
  // Zaehlt Schreib-"Absichten" je Schluessel hoch (manuelle Auswahl wie auch
  // gestartetes Laden). Ein Ladevorgang schreibt sein Ergebnis nur, wenn sich
  // die Version seit seinem Start nicht veraendert hat — sonst hat der Nutzer
  // in der Zwischenzeit bereits selbst ein anderes Profil gewaehlt.
  versions: Record<string, number>;
  inFlight: Record<string, Promise<void> | undefined>;
  setProfile: (key: string, householdId: string, userId: string, profile: ActiveProfile) => void;
  loadProfile: (key: string, householdId: string, userId: string) => Promise<void>;
}

/**
 * Zustand-Store für das aktive Tracking-Profil (Erwachsener oder Kind), geteilt
 * über alle Screens hinweg — vorher hielt jeder Screen (Diary, Add-Food) seinen
 * eigenen `useState`, wodurch ein Profilwechsel in einem Screen im anderen nicht
 * sichtbar war. Jeder Hook-Mount stößt eine Revalidierung an (z. B. falls ein
 * Kindprofil zwischenzeitlich gelöscht wurde); parallele Aufrufe für denselben
 * Schlüssel teilen sich dabei einen In-Flight-Request statt zu duplizieren.
 */
const useActiveProfileStore = create<ActiveProfileStore>((set, get) => ({
  profilesByKey: {},
  versions: {},
  inFlight: {},

  setProfile: (key, householdId, userId, profile) => {
    set((state) => ({
      profilesByKey: { ...state.profilesByKey, [key]: profile },
      versions: { ...state.versions, [key]: (state.versions[key] ?? 0) + 1 },
    }));
    setStoredActiveChildProfileId(
      userId,
      householdId,
      profile.type === 'child' ? profile.childProfileId : null,
    );
  },

  loadProfile: (key, householdId, userId) => {
    const existing = get().inFlight[key];
    if (existing) return existing;

    const startVersion = get().versions[key] ?? 0;

    const promise = (async () => {
      const childProfileId = await getStoredActiveChildProfileId(userId, householdId);

      let resolved: ActiveProfile;
      if (!childProfileId) {
        resolved = { type: 'adult', userId };
      } else {
        const stillExists = await childProfileExists(householdId, childProfileId);
        if (!stillExists) {
          await setStoredActiveChildProfileId(userId, householdId, null);
          resolved = { type: 'adult', userId };
        } else {
          resolved = { type: 'child', childProfileId, householdId };
        }
      }

      // Waehrend des Ladens hat der Nutzer bereits manuell gewaehlt — das
      // veraltete Ladeergebnis darf diese Auswahl nicht ueberschreiben.
      if ((get().versions[key] ?? 0) !== startVersion) return;
      set((state) => ({ profilesByKey: { ...state.profilesByKey, [key]: resolved } }));
    })();

    set((state) => ({ inFlight: { ...state.inFlight, [key]: promise } }));

    return promise.finally(() => {
      set((state) => {
        const { [key]: _removed, ...rest } = state.inFlight;
        return { inFlight: rest };
      });
    });
  },
}));

export function useActiveProfile(householdId: string | undefined): {
  profile: ActiveProfile | null;
  setProfile: (profile: ActiveProfile) => void;
} {
  const { session } = useSession();
  const userId = session?.user.id;
  const key = userId && householdId ? cacheKey(userId, householdId) : null;

  // Der Selector liefert nur eine bereits im Store liegende Referenz oder
  // `null` zurueck — nie ein frisches Objekt — damit `getSnapshot` stabil
  // bleibt (sonst React-19/Zustand-5-Endlosschleife bei fehlendem Haushalt).
  const storedProfile = useActiveProfileStore((state) =>
    key ? (state.profilesByKey[key] ?? null) : null,
  );
  const loadProfile = useActiveProfileStore((state) => state.loadProfile);
  const storeSetProfile = useActiveProfileStore((state) => state.setProfile);

  const profile = useMemo((): ActiveProfile | null => {
    if (!userId) return null;
    if (!householdId) return { type: 'adult', userId };
    return storedProfile;
  }, [userId, householdId, storedProfile]);

  useEffect(() => {
    if (!userId || !householdId || !key) return;
    loadProfile(key, householdId, userId);
  }, [userId, householdId, key, loadProfile]);

  function setProfile(next: ActiveProfile) {
    if (householdId && userId && key) {
      storeSetProfile(key, householdId, userId, next);
    }
  }

  return { profile, setProfile };
}
