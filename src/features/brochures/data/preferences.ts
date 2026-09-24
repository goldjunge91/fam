import { getEncryptedAccountStorage } from '@/lib/storage/account-storage';

const BROCHURE_POSTAL_CODE_KEY = 'brochures.postal-code';
const BROCHURE_POSTAL_CODE_SOURCE_KEY = 'brochures.postal-code-source';
const POSTAL_CODE_PATTERN = /^\d{5}$/;

/** Woher die gespeicherte PLZ stammt: automatisch per GPS oder vom Nutzer manuell eingetragen. */
export type BrochurePostalCodeSource = 'gps' | 'manual';

export async function getBrochurePostalCode(userId: string): Promise<string | null> {
  const storage = await getEncryptedAccountStorage(userId);
  const postalCode = storage.getString(BROCHURE_POSTAL_CODE_KEY);

  if (!postalCode) return null;
  if (POSTAL_CODE_PATTERN.test(postalCode)) return postalCode;

  storage.remove(BROCHURE_POSTAL_CODE_KEY);
  return null;
}

export async function getBrochurePostalCodeSource(
  userId: string,
): Promise<BrochurePostalCodeSource | null> {
  const storage = await getEncryptedAccountStorage(userId);
  const source = storage.getString(BROCHURE_POSTAL_CODE_SOURCE_KEY);
  return source === 'manual' || source === 'gps' ? source : null;
}

export async function setBrochurePostalCode(
  userId: string,
  postalCode: string,
  source: BrochurePostalCodeSource = 'gps',
): Promise<void> {
  if (!POSTAL_CODE_PATTERN.test(postalCode)) {
    throw new Error('Eine deutsche Postleitzahl muss aus genau fünf Ziffern bestehen.');
  }

  const storage = await getEncryptedAccountStorage(userId);
  storage.set(BROCHURE_POSTAL_CODE_KEY, postalCode);
  storage.set(BROCHURE_POSTAL_CODE_SOURCE_KEY, source);
}

/** Markiert die gespeicherte PLZ wieder als GPS-Quelle, ohne den Wert selbst zu ändern. */
export async function markBrochurePostalCodeAsDeviceLocation(userId: string): Promise<void> {
  const storage = await getEncryptedAccountStorage(userId);
  storage.set(BROCHURE_POSTAL_CODE_SOURCE_KEY, 'gps' satisfies BrochurePostalCodeSource);
}
