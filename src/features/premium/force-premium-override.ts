import { create } from 'zustand';

import { getDeviceStorage } from '@/lib/storage/device-storage';

const STORAGE_KEY = 'dev.force_premium_override';

/**
 * Laufzeit-Override für Premium in bereits kompilierten Builds (z. B. TestFlight), in
 * denen `EXPO_PUBLIC_FORCE_PREMIUM` nicht mehr geändert werden kann. `null` bedeutet
 * "kein Override", dann gilt der zur Build-Zeit gesetzte `env.forcePremium`-Wert.
 */
function readStoredOverride(): boolean | null {
  try {
    const raw = getDeviceStorage().getString(STORAGE_KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return null;
  } catch {
    return null;
  }
}

interface ForcePremiumOverrideStore {
  override: boolean | null;
  setOverride: (value: boolean | null) => void;
}

export const useForcePremiumOverrideStore = create<ForcePremiumOverrideStore>((set) => ({
  override: readStoredOverride(),
  setOverride: (value) => {
    try {
      const storage = getDeviceStorage();
      if (value === null) {
        storage.remove(STORAGE_KEY);
      } else {
        storage.set(STORAGE_KEY, String(value));
      }
    } catch (err) {
      console.warn('[Premium] Override konnte nicht gespeichert werden:', err);
    }
    set({ override: value });
  },
}));
