import { create } from 'zustand';

import { env } from '@/lib/env';
import { getDeviceStorage } from '@/lib/storage/device-storage';

const STORAGE_KEY = 'dev.ads_enabled_override';

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

interface AdsOverrideStore {
  override: boolean | null;
  setOverride: (value: boolean | null) => void;
}

/** Laufzeit-Override fuer Werbung, primaer fuer Dev-Builds und TestFlight. */
export const useAdsOverrideStore = create<AdsOverrideStore>((set) => ({
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
      console.warn('[Ads] Override konnte nicht gespeichert werden:', err);
    }
    set({ override: value });
  },
}));

/** Liefert den aktuell wirksamen Werbezustand fuer Nicht-React-Code. */
export function getAdsEnabled(): boolean {
  return useAdsOverrideStore.getState().override ?? env.adsEnabled;
}

/** Reaktiver Werbezustand fuer Komponenten und Hooks. */
export function useAdsEnabled(): boolean {
  const override = useAdsOverrideStore((state) => state.override);
  return override ?? env.adsEnabled;
}
