/**
 * Consent is handled by the native UMP SDK. Ads are disabled on web, so the
 * web adapter deliberately reports that ads are not ready.
 */
export function useAdsConsentReady(): boolean {
  return false;
}

export function getAdsConsentReady(): boolean {
  return false;
}

export async function gatherAdsConsent(): Promise<boolean> {
  return false;
}

export async function showAdsPrivacyOptions(): Promise<boolean> {
  return false;
}
