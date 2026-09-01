import {
  getTrackingPermissionsAsync,
  PermissionStatus,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import { Platform } from 'react-native';
import {
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
} from 'react-native-google-mobile-ads';
import { create } from 'zustand';

import { getAdsEnabled } from './ads-override';

type AdsConsentState = {
  ready: boolean;
  setReady: (ready: boolean) => void;
};

/** Reaktiver Zustand: Anzeigen dürfen erst nach dem Consent-Prozess laden. */
export const useAdsConsentStore = create<AdsConsentState>((set) => ({
  ready: false,
  setReady: (ready) => set({ ready }),
}));

export function useAdsConsentReady(): boolean {
  return useAdsConsentStore((state) => state.ready);
}

export function getAdsConsentReady(): boolean {
  return useAdsConsentStore.getState().ready;
}

async function requestAppleTrackingPermission(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  const permission = await getTrackingPermissionsAsync();
  if (permission.status === PermissionStatus.UNDETERMINED) {
    await requestTrackingPermissionsAsync();
  }
}

async function hasConsentForAds(): Promise<boolean> {
  const consentInfo = await AdsConsent.gatherConsent();

  if (!consentInfo.canRequestAds) return false;

  if (Platform.OS === 'ios') {
    const gdprApplies = await AdsConsent.getGdprApplies();
    const hasPurposeOneConsent =
      !gdprApplies || (await AdsConsent.getPurposeConsents()).startsWith('1');

    if (hasPurposeOneConsent) {
      await requestAppleTrackingPermission();
    }
  }

  return true;
}

/**
 * Holt den aktuellen Google-UMP-Consent und fordert danach iOS-ATT an.
 * Bei einem UMP-Netzwerkfehler wird der zuletzt gespeicherte Consent verwendet.
 */
export async function gatherAdsConsent(): Promise<boolean> {
  if (!getAdsEnabled()) {
    useAdsConsentStore.getState().setReady(false);
    return false;
  }

  try {
    const ready = await hasConsentForAds();
    useAdsConsentStore.getState().setReady(ready);
    return ready;
  } catch (error) {
    try {
      const previousConsent = await AdsConsent.getConsentInfo();
      const ready = previousConsent.canRequestAds;
      useAdsConsentStore.getState().setReady(ready);
      return ready;
    } catch {
      useAdsConsentStore.getState().setReady(false);
      if (__DEV__) {
        console.warn('[AdMob] Consent konnte nicht geprüft werden:', error);
      }
      return false;
    }
  }
}

/** Öffnet die von Google verwalteten Privacy-Optionen erneut, falls verfügbar. */
export async function showAdsPrivacyOptions(): Promise<boolean> {
  const consentInfo = await AdsConsent.getConsentInfo();
  if (
    consentInfo.privacyOptionsRequirementStatus !==
    AdsConsentPrivacyOptionsRequirementStatus.REQUIRED
  ) {
    return false;
  }

  const updatedConsent = await AdsConsent.showPrivacyOptionsForm();
  const ready = updatedConsent.canRequestAds;
  useAdsConsentStore.getState().setReady(ready);
  return ready;
}
