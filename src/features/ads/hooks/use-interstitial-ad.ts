import { useCallback, useEffect } from 'react';
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
    if (!isPremium && autoLoad && !isLoaded && !isOpened) {
      if (__DEV__) {
        console.log(`[AdMob Interstitial] Lade Interstitial-Anzeige (Unit-ID: ${resolvedUnitId})…`);
      }
      load();
    }
  }, [isPremium, autoLoad, isLoaded, isOpened, load, resolvedUnitId]);

  // Automatisch nach dem Schließen für den nächsten Aufruf vorladen
  useEffect(() => {
    if (!isPremium && autoLoad && isClosed) {
      if (__DEV__) {
        console.log('[AdMob Interstitial] Anzeige geschlossen. Lade nächste Anzeige vor…');
      }
      load();
    }
  }, [isPremium, autoLoad, isClosed, load]);

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
    load: isPremium ? () => {} : load,
    show,
  };
}
