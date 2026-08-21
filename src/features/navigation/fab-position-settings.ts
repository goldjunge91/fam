import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Ecke des globalen Plus-Buttons (#150-Folge "F2 Speed-Dial"), geräteweit —
 * analog zu `meal-planner/settings.ts`. Keine Haushalts-/Account-Einstellung,
 * reine Bedienpräferenz (Rechts-/Linkshänder), deshalb lokal statt Supabase.
 */
const STORAGE_KEY = '@fam/fab_position';

export type FabPosition = 'left' | 'right';
export const DEFAULT_FAB_POSITION: FabPosition = 'right';

export async function getFabPosition(): Promise<FabPosition> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw === 'left' || raw === 'right' ? raw : DEFAULT_FAB_POSITION;
  } catch {
    return DEFAULT_FAB_POSITION;
  }
}

export async function setFabPosition(value: FabPosition): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Bewusst still: ein fehlgeschlagenes Speichern der Einstellung darf den
    // Rest der App nicht blockieren, siehe active-household-store.ts.
  }
}

export const fabPositionQueryKey = ['settings', 'fab-position'] as const;

export function useFabPosition() {
  return useQuery({ queryKey: fabPositionQueryKey, queryFn: getFabPosition });
}

export function useSetFabPosition() {
  const queryClient = useQueryClient();
  return async (value: FabPosition) => {
    await setFabPosition(value);
    await queryClient.invalidateQueries({ queryKey: fabPositionQueryKey });
  };
}
