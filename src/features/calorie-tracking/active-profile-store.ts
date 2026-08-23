import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { useSession } from '@/features/auth/session-provider';
import { getSupabase } from '@/lib/supabase';

/** Das Kindprofil ergaenzt die weiterhin erforderliche Erwachsenen-`user_id`. */
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
  } catch {}
}

/** Validiert die gespeicherte Kind-Auswahl vor einem Insert mit Fremdschluessel. */
async function childProfileExists(householdId: string, childProfileId: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('child_profiles')
    .select('id')
    .eq('id', childProfileId)
    .eq('household_id', householdId)
    .maybeSingle();

  if (error) {
    // Voruebergehende Fehler duerfen die gespeicherte Auswahl nicht verwerfen.
    return true;
  }
  return data != null;
}

/** Laedt die je Haushalt gespeicherte und gegen die DB validierte Profilauswahl. */
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
    getStoredActiveChildProfileId(householdId).then(async (childProfileId) => {
      if (cancelled || !childProfileId) {
        if (!cancelled) setProfileState({ type: 'adult', userId });
        return;
      }

      const stillExists = await childProfileExists(householdId, childProfileId);
      if (cancelled) return;

      if (!stillExists) {
        await setStoredActiveChildProfileId(householdId, null);
        if (!cancelled) setProfileState({ type: 'adult', userId });
        return;
      }

      setProfileState({ type: 'child', childProfileId, householdId });
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
