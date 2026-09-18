import { useCallback } from 'react';
import type { UseInterstitialAdOptions } from './use-interstitial-ad';

/** Web has no native interstitial surface. */
export function useInterstitialAd(_options: UseInterstitialAdOptions = {}) {
  const load = useCallback(() => {}, []);
  const show = useCallback(() => {}, []);

  return {
    isLoaded: false,
    isOpened: false,
    isClosed: false,
    error: undefined,
    load,
    show,
  };
}
