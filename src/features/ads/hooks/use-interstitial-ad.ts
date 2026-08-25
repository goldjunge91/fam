import { useCallback, useEffect, useRef } from 'react';
import {
  type RequestOptions,
  TestIds,
  useInterstitialAd as useGoogleInterstitialAd,
} from 'react-native-google-mobile-ads';
import { usePremium } from '@/features/premium/premium-provider';
import { env } from '@/lib/env';

export interface UseInterstitialAdOptions {
  adUnitId?: string;
  requestOptions?: RequestOptions;
  autoLoad?: boolean;
}

/**
 * Hook für Interstitial-Werbung (Vollbildanzeigen) mit automatischem Premium-Gating.
 *
 * Wenn der aktive Haushalt Premium hat (`isPremium === true`), wird die Anzeige
 * weder geladen noch angezeigt, und `show()` ist ein sofortiger No-Op.
 */
export function useInterstitialAd({
  adUnitId,
  requestOptions,
  autoLoad = true,
}: UseInterstitialAdOptions = {}) {
  const { isPremium } = usePremium();

  const defaultUnitId = __DEV__ ? TestIds.INTERSTITIAL : env.adMobInterstitialIdIos;
  const resolvedUnitId = adUnitId ?? defaultUnitId;
  const adUnit = isPremium ? null : resolvedUnitId;
  const {
    isLoaded,
    isOpened,
    isClosed,
    error,
    load,
    show: rawShow,
  } = useGoogleInterstitialAd(adUnit, requestOptions);
  const loadRequestedRef = useRef(false);

  const requestLoad = useCallback(() => {
    if (loadRequestedRef.current) return;
    loadRequestedRef.current = true;
    load();
  }, [load]);

  // `load()` synchronously resets the native hook state. Without this guard,
  // the state reset after a closed ad re-enters the initial auto-load effect
  // and starts a second request while the first reload is already pending.
  useEffect(() => {
    if (isLoaded) loadRequestedRef.current = false;
  }, [isLoaded]);

  useEffect(() => {
    if (error && __DEV__) {
      console.warn('[AdMob Interstitial] Fehler beim Laden der Anzeige:', error);
    }
  }, [error]);

  useEffect(() => {
    if (isLoaded && __DEV__) {
      console.log('[AdMob Interstitial] Anzeige erfolgreich im Hintergrund vorgeladen.');
    }
  }, [isLoaded]);

  useEffect(() => {
    if (!isPremium && autoLoad && !isLoaded && !isOpened && !isClosed) {
      if (__DEV__) {
        console.log(`[AdMob Interstitial] Lade Interstitial-Anzeige (Unit-ID: ${resolvedUnitId})…`);
      }
      requestLoad();
    }
  }, [isPremium, autoLoad, isLoaded, isOpened, isClosed, requestLoad, resolvedUnitId]);

  // Automatisch nach dem Schließen für den nächsten Aufruf vorladen
  useEffect(() => {
    if (!isPremium && autoLoad && isClosed) {
      if (__DEV__) {
        console.log('[AdMob Interstitial] Anzeige geschlossen. Lade nächste Anzeige vor…');
      }
      requestLoad();
    }
  }, [isPremium, autoLoad, isClosed, requestLoad]);

  const show = useCallback(() => {
    if (isPremium) {
      if (__DEV__) {
        console.log(
          '[AdMob Interstitial] show() übersprungen: Aktiver Haushalt/Nutzer hat Premium-Status.',
        );
      }
      return;
    }
    if (isLoaded) {
      if (__DEV__) {
        console.log('[AdMob Interstitial] show() - Vollbildanzeige wird geöffnet.');
      }
      rawShow();
    } else {
      if (__DEV__) {
        console.warn(
          '[AdMob Interstitial] show() aufgerufen, aber Anzeige ist noch nicht bereit (isLoaded=false). ' +
            (error
              ? `Letzter Ladefehler: ${error.message}`
              : 'Wird noch geladen oder nicht initialisiert.'),
        );
      }
    }
  }, [isPremium, isLoaded, rawShow, error]);

  return {
    isLoaded: isPremium ? false : isLoaded,
    isOpened,
    isClosed,
    error,
    load: isPremium ? () => {} : requestLoad,
    show,
  };
}
