import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { DEFAULT_PORTIONS_PER_PERSON } from './servings';

const STORAGE_KEY = '@fam/meal_planner_portions_per_person';

export async function getPortionsPerPerson(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PORTIONS_PER_PERSON;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PORTIONS_PER_PERSON;
  } catch {
    return DEFAULT_PORTIONS_PER_PERSON;
  }
}

export async function setPortionsPerPerson(value: number): Promise<void> {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('portionsPerPerson muss positiv sein');
  }
  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Bewusst still: ein fehlgeschlagenes Speichern der Einstellung darf den
    // Rest der App nicht blockieren, siehe active-household-store.ts.
  }
}

export const portionsPerPersonQueryKey = ['settings', 'meal-planner-portions-per-person'] as const;

export function usePortionsPerPerson() {
  return useQuery({
    queryKey: portionsPerPersonQueryKey,
    queryFn: getPortionsPerPerson,
  });
}

export function useSetPortionsPerPerson() {
  const queryClient = useQueryClient();
  return async (value: number) => {
    await setPortionsPerPerson(value);
    await queryClient.invalidateQueries({ queryKey: portionsPerPersonQueryKey });
  };
}
