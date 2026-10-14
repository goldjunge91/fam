import {
  gatherAdsConsent,
  getAdsConsentReady,
  showAdsPrivacyOptions,
  useAdsConsentReady,
} from './ads-consent.web';
import { BannerAdSize, TestIds } from './ads-constants.web';
import { getAdsEnabled, useAdsEnabled, useAdsOverrideStore } from './ads-override.web';
import { initMobileAds, trackAdRevenueToRevenueCat } from './ads-service.web';
import { AdBanner } from './components/ad-banner.web';

describe('web ads adapters', () => {
  beforeEach(() => {
    useAdsOverrideStore.getState().setOverride(null);
  });

  test('keeps ad consent disabled', async () => {
    expect(useAdsConsentReady()).toBe(false);
    expect(getAdsConsentReady()).toBe(false);
    await expect(gatherAdsConsent()).resolves.toBe(false);
    await expect(showAdsPrivacyOptions()).resolves.toBe(false);
  });

  test('keeps ads disabled even when an override is set', () => {
    useAdsOverrideStore.getState().setOverride(true);

    expect(useAdsOverrideStore.getState().override).toBe(true);
    expect(getAdsEnabled()).toBe(false);
    expect(useAdsEnabled()).toBe(false);
  });

  test('exposes empty native ad identifiers for shared callers', () => {
    expect(BannerAdSize.BANNER).toBe('BANNER');
    expect(Object.values(TestIds).every((testId) => testId === '')).toBe(true);
  });

  test('does not initialize native ads or forward revenue events', async () => {
    await expect(initMobileAds()).resolves.toBeUndefined();
    await expect(
      trackAdRevenueToRevenueCat({
        adUnitId: 'web-ad',
        paidEvent: { currency: 'EUR', precision: 0, value: 0.05 },
      }),
    ).resolves.toBeUndefined();
  });

  test('does not render a native banner on web', () => {
    expect(AdBanner({ unitId: 'web-ad' })).toBeNull();
  });
});
