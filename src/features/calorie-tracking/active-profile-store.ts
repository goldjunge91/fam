import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { useSession } from '@/features/auth/session-provider';

/**
 * Aktives Tracking-Profil (#65/#85): der eingeloggte Erwachsene selbst oder
 * eines seiner Kinder. `child_profile_id` ist ein Zusatz-Tag auf
 * `food_entries`/`user_goals` — der `user_id` des loggenden Erwachsenen bleibt
 * immer gesetzt (`user_id not null`, keine XOR-Constraint). Kind-Sichtbarkeit
 * laeuft komplett ueber den Account des Erwachsenen; es gibt keinen eigenen
 * Kind-Login und keine kindspezifische RLS-Policy.
 */
export type ActiveProfile =
  | { type: 'adult'; userId: string }
  | { type: 'child'; childProfileId: string; householdId: string };

function storageKey(householdId: string): string {
  return `@fam/active_child_profile_id/${householdId}`;
}

export async function getStoredActiveChildProfileId(householdId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(storageKey(householdId));
  } catch {
    return null;
  }
}

export async function setStoredActiveChildProfileId(
  householdId: string,
  childProfileId: string | null,
): Promise<void> {
  try {
    if (childProfileId) {
      await AsyncStorage.setItem(storageKey(householdId), childProfileId);
    } else {
      await AsyncStorage.removeItem(storageKey(householdId));
    }
  } catch {
    // Stiller Fallback, wie active-household-store.ts.
  }
}

/**
 * Liefert das aktive Profil fuer die Kalorien-Tracking-Screens, Default ist
 * immer der eingeloggte Erwachsene. Eine gespeicherte Kind-Auswahl je
 * Haushalt ueberlebt einen Neustart.
 */
export function useActiveProfile(householdId: string | undefined): {
  profile: ActiveProfile | null;
  setProfile: (profile: ActiveProfile) => void;
} {
  const { session } = useSession();
  const userId = session?.user.id;
  const [profile, setProfileState] = useState<ActiveProfile | null>(null);

  useEffect(() => {
    if (!userId) {
      setProfileState(null);
      return;
    }
    if (!householdId) {
      setProfileState({ type: 'adult', userId });
      return;
    }

    let cancelled = false;
    getStoredActiveChildProfileId(householdId).then((childProfileId) => {
      if (cancelled) return;
      setProfileState(
        childProfileId ? { type: 'child', childProfileId, householdId } : { type: 'adult', userId },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [userId, householdId]);

  function setProfile(next: ActiveProfile) {
    setProfileState(next);
    if (householdId) {
      setStoredActiveChildProfileId(
        householdId,
        next.type === 'child' ? next.childProfileId : null,
      );
    }
  }

  return { profile, setProfile };
}
