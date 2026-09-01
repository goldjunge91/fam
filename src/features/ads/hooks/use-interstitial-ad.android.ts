import { useCallback, useEffect, useRef } from 'react';
import {
  type RequestOptions,
  TestIds,
  useInterstitialAd as useGoogleInterstitialAd,
} from 'react-native-google-mobile-ads';
import { usePremium } from '@/features/premium/premium-provider';
import { env } from '@/lib/env';
import { useAdsConsentReady } from '../ads-consent';
import { useAdsEnabled } from '../ads-override';

export interface UseInterstitialAdOptions {
  adUnitId?: string;
  requestOptions?: RequestOptions;
  autoLoad?: boolean;
}

export function useInterstitialAd({
  adUnitId,
  requestOptions,
  autoLoad = true,
}: UseInterstitialAdOptions = {}) {
  const { isPremium } = usePremium();
  const adsEnabled = useAdsEnabled();
  const adsConsentReady = useAdsConsentReady();

  const defaultUnitId = __DEV__ ? TestIds.INTERSTITIAL : env.adMobInterstitialIdAndroid;
  const resolvedUnitId = adUnitId ?? defaultUnitId;
  const adUnit = adsEnabled && adsConsentReady && !isPremium ? resolvedUnitId : null;
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

  // Verhindert parallele Requests nach dem synchronen Reset durch `load()`.
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
    if (
      adsEnabled &&
      adsConsentReady &&
      !isPremium &&
      autoLoad &&
      !isLoaded &&
      !isOpened &&
      !isClosed
    ) {
      if (__DEV__) {
        console.log(`[AdMob Interstitial] Lade Interstitial-Anzeige (Unit-ID: ${resolvedUnitId})…`);
      }
      requestLoad();
    }
  }, [
    isPremium,
    autoLoad,
    isLoaded,
    isOpened,
    isClosed,
    requestLoad,
    resolvedUnitId,
    adsEnabled,
    adsConsentReady,
  ]);

  // Automatisch nach dem Schließen für den nächsten Aufruf vorladen
  useEffect(() => {
    if (adsEnabled && adsConsentReady && !isPremium && autoLoad && isClosed) {
      if (__DEV__) {
        console.log('[AdMob Interstitial] Anzeige geschlossen. Lade nächste Anzeige vor…');
      }
      requestLoad();
    }
  }, [isPremium, autoLoad, isClosed, requestLoad, adsEnabled, adsConsentReady]);

  const show = useCallback(() => {
    if (!adsEnabled || !adsConsentReady || isPremium) {
      if (__DEV__) {
        console.log(
          `[AdMob Interstitial] show() übersprungen: Werbung ist ${adsEnabled ? 'für Premium deaktiviert' : 'global deaktiviert'}.`,
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
  }, [isPremium, isLoaded, rawShow, error, adsEnabled, adsConsentReady]);

  return {
    isLoaded: adsEnabled && adsConsentReady && !isPremium ? isLoaded : false,
    isOpened,
    isClosed,
    error,
    load: adsEnabled && adsConsentReady && !isPremium ? requestLoad : () => {},
    show,
  };
}
