import { create } from 'zustand';

type AdsOverrideState = {
  override: boolean | null;
  setOverride: (value: boolean | null) => void;
};

/** Web never loads native ads, regardless of the native ads override. */
export const useAdsOverrideStore = create<AdsOverrideState>((set) => ({
  override: null,
  setOverride: (override) => set({ override }),
}));

export function getAdsEnabled(): boolean {
  return false;
}

export function useAdsEnabled(): boolean {
  return false;
}
