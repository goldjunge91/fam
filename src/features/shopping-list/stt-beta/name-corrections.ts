import { getEncryptedAccountStorage } from '@/lib/storage/account-storage';

export type NameCorrection = { original: string; corrected: string };
export const NAME_CORRECTIONS_KEY = 'natural-language-addition-name-corrections.v1';

export function normalizeCorrectionName(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('de-DE');
}

export async function getNameCorrections(userId: string): Promise<readonly NameCorrection[]> {
  const storage = await getEncryptedAccountStorage(userId);
  const serialized = storage.getString(NAME_CORRECTIONS_KEY);
  if (!serialized) return [];
  try {
    const value: unknown = JSON.parse(serialized);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (entry): entry is NameCorrection =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof entry.original === 'string' &&
        entry.original.trim().length > 0 &&
        typeof entry.corrected === 'string' &&
        entry.corrected.trim().length > 0,
    );
  } catch {
    return [];
  }
}

/** Only explicit remember/forget actions write this account-local vocabulary. */
export async function updateNameCorrection(
  userId: string,
  original: string,
  corrected: string | null,
): Promise<readonly NameCorrection[]> {
  const key = normalizeCorrectionName(original);
  if (!key || (corrected !== null && !corrected.trim())) {
    throw new Error('Bitte einen Artikelnamen eingeben.');
  }
  const corrections = (await getNameCorrections(userId)).filter(
    (entry) => normalizeCorrectionName(entry.original) !== key,
  );
  if (corrected !== null && normalizeCorrectionName(corrected) !== key) {
    corrections.push({ original: original.trim(), corrected: corrected.trim() });
  }
  const storage = await getEncryptedAccountStorage(userId);
  storage.set(NAME_CORRECTIONS_KEY, JSON.stringify(corrections));
  return corrections;
}
