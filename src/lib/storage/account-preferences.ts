import AsyncStorage from '@react-native-async-storage/async-storage';
import { getEncryptedAccountStorage } from './account-storage';

const BROCHURE_POSTAL_CODE_KEY = 'brochures.postal-code';
const LEGACY_BROCHURE_POSTAL_CODE_KEY = '@fam/brochures/postal-code-v1';
const LEGACY_BROCHURE_POSTAL_CODE_MARKER = '@fam/migrations/brochure-postal-code-v1';
const POSTAL_CODE_PATTERN = /^\d{5}$/;

export async function getBrochurePostalCode(userId: string): Promise<string | null> {
  const storage = await getEncryptedAccountStorage(userId);
  const postalCode = storage.getString(BROCHURE_POSTAL_CODE_KEY);

  if (!postalCode) return null;
  if (POSTAL_CODE_PATTERN.test(postalCode)) return postalCode;

  storage.remove(BROCHURE_POSTAL_CODE_KEY);
  return null;
}

export async function setBrochurePostalCode(userId: string, postalCode: string): Promise<void> {
  if (!POSTAL_CODE_PATTERN.test(postalCode)) {
    throw new Error('Eine deutsche Postleitzahl muss aus genau fünf Ziffern bestehen.');
  }

  const storage = await getEncryptedAccountStorage(userId);
  storage.set(BROCHURE_POSTAL_CODE_KEY, postalCode);
}

export async function migrateLegacyBrochurePostalCode(
  restoredUserId: string | null,
): Promise<void> {
  if (await AsyncStorage.getItem(LEGACY_BROCHURE_POSTAL_CODE_MARKER)) {
    await AsyncStorage.removeItem(LEGACY_BROCHURE_POSTAL_CODE_KEY);
    return;
  }

  const postalCode = await AsyncStorage.getItem(LEGACY_BROCHURE_POSTAL_CODE_KEY);
  if (postalCode && restoredUserId && POSTAL_CODE_PATTERN.test(postalCode)) {
    await setBrochurePostalCode(restoredUserId, postalCode);
  }

  await AsyncStorage.removeItem(LEGACY_BROCHURE_POSTAL_CODE_KEY);
  await AsyncStorage.setItem(LEGACY_BROCHURE_POSTAL_CODE_MARKER, 'done');
}
