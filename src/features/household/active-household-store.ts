import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@fam/active_household_id';

export async function getStoredActiveHouseholdId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function setStoredActiveHouseholdId(id: string | null): Promise<void> {
  try {
    if (id) {
      await AsyncStorage.setItem(STORAGE_KEY, id);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}
