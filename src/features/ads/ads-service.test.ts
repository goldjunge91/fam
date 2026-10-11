import { RevenuePrecisions } from 'react-native-google-mobile-ads';
import { AdFormat, AdMediatorName, AdRevenuePrecision } from 'react-native-purchases';

import { useAdsConsentStore } from './ads-consent';
import { useAdsOverrideStore } from './ads-override';
import { initMobileAds, trackAdRevenueToRevenueCat } from './ads-service';

let mockPurchasesConfigured = false;
let mockConsentCanRequestAds = true;
const mockTrackAdRevenue = jest.fn();
const mockInitializeMobileAds = jest.fn();

jest.mock('@/lib/backend/revenuecat', () => ({
  isPurchasesConfigured: () => mockPurchasesConfigured,
}));

jest.mock('react-native-google-mobile-ads', () => ({
  __esModule: true,
  default: () => ({
    initialize: (...args: unknown[]) => mockInitializeMobileAds(...args),
  }),
  AdsConsent: {
    gatherConsent: jest.fn(() => Promise.resolve({ canRequestAds: mockConsentCanRequestAds })),
    getConsentInfo: jest.fn().mockResolvedValue({ canRequestAds: true }),
    getGdprApplies: jest.fn().mockResolvedValue(false),
  },
  RevenuePrecisions: {
    PRECISE: 1,
    ESTIMATED: 2,
    PUBLISHER_PROVIDED: 3,
    UNKNOWN: 0,
  },
}));

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    adTracker: {
      trackAdRevenue: (...args: unknown[]) => mockTrackAdRevenue(...args),
    },
  },
  AdMediatorName: {
    adMob: 'AdMob',
  },
  AdFormat: {
    banner: 'banner',
  },
  AdRevenuePrecision: {
    exact: 'exact',
    estimated: 'estimated',
    publisherDefined: 'publisher_defined',
    unknown: 'unknown',
  },
}));

describe('ads-service', () => {
  const originalAdsEnabled = process.env.EXPO_PUBLIC_ADS_ENABLED;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_ADS_ENABLED = 'true';
    mockPurchasesConfigured = false;
    mockConsentCanRequestAds = true;
    mockInitializeMobileAds.mockReset().mockResolvedValue([]);
    useAdsOverrideStore.getState().setOverride(null);
    useAdsConsentStore.getState().setReady(false);
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalAdsEnabled === undefined) {
      delete process.env.EXPO_PUBLIC_ADS_ENABLED;
    } else {
      process.env.EXPO_PUBLIC_ADS_ENABLED = originalAdsEnabled;
    }
  });

  it('initialisiert das SDK weder bei global deaktivierter Werbung noch ohne Consent', async () => {
    process.env.EXPO_PUBLIC_ADS_ENABLED = 'false';
    await expect(initMobileAds()).resolves.toBeUndefined();
    expect(mockInitializeMobileAds).not.toHaveBeenCalled();

    process.env.EXPO_PUBLIC_ADS_ENABLED = 'true';
    mockConsentCanRequestAds = false;
    await expect(initMobileAds()).resolves.toBeUndefined();
    expect(mockInitializeMobileAds).not.toHaveBeenCalled();
  });

  it('fängt einen SDK-Fehler ab und teilt danach den erfolgreichen Start', async () => {
    mockInitializeMobileAds.mockRejectedValueOnce(new Error('native SDK unavailable'));
    await expect(initMobileAds()).resolves.toBeUndefined();
    expect(mockInitializeMobileAds).toHaveBeenCalledTimes(1);

    mockInitializeMobileAds.mockClear();
    await Promise.all([initMobileAds(), initMobileAds()]);
    await initMobileAds();

    expect(mockInitializeMobileAds).toHaveBeenCalledTimes(1);
  });

  it('trackAdRevenueToRevenueCat leitet Daten an Purchases.adTracker weiter wenn konfiguriert', async () => {
    mockPurchasesConfigured = true;

    await trackAdRevenueToRevenueCat({
      adUnitId: 'test-ad-unit',
      paidEvent: {
        value: 0.05,
        currency: 'EUR',
        precision: 1, // PRECISE
      },
      placement: 'inventory',
    });

    expect(mockTrackAdRevenue).toHaveBeenCalledTimes(1);
    expect(mockTrackAdRevenue).toHaveBeenCalledWith(
      expect.objectContaining({
        mediatorName: AdMediatorName.adMob,
        adUnitId: 'test-ad-unit',
        revenueMicros: 50000,
        adFormat: AdFormat.banner,
        currency: 'EUR',
        precision: AdRevenuePrecision.exact,
        placement: 'inventory',
      }),
    );
  });

  it('trackAdRevenueToRevenueCat ist ein No-op wenn RevenueCat nicht konfiguriert ist', async () => {
    mockPurchasesConfigured = false;

    await trackAdRevenueToRevenueCat({
      adUnitId: 'test-ad-unit',
      paidEvent: {
        value: 0.05,
        currency: 'EUR',
        precision: 1,
      },
    });

    expect(mockTrackAdRevenue).not.toHaveBeenCalled();
  });

  it.each([
    [RevenuePrecisions.ESTIMATED, AdRevenuePrecision.estimated],
    [RevenuePrecisions.PUBLISHER_PROVIDED, AdRevenuePrecision.publisherDefined],
    [RevenuePrecisions.UNKNOWN, AdRevenuePrecision.unknown],
  ])('übersetzt Revenue-Precision %s', async (precision, expectedPrecision) => {
    mockPurchasesConfigured = true;

    await trackAdRevenueToRevenueCat({
      adUnitId: 'test-ad-unit',
      adFormat: 'interstitial',
      paidEvent: { value: 0.01, currency: 'EUR', precision },
    });

    expect(mockTrackAdRevenue).toHaveBeenCalledWith(
      expect.objectContaining({ adFormat: 'interstitial', precision: expectedPrecision }),
    );
  });

  it('ignoriert Events bei global deaktivierter Werbung und fängt RevenueCat-Fehler ab', async () => {
    mockPurchasesConfigured = true;
    process.env.EXPO_PUBLIC_ADS_ENABLED = 'false';
    await trackAdRevenueToRevenueCat({
      adUnitId: 'test-ad-unit',
      paidEvent: { value: 0.01, currency: 'EUR', precision: RevenuePrecisions.PRECISE },
    });
    expect(mockTrackAdRevenue).not.toHaveBeenCalled();

    process.env.EXPO_PUBLIC_ADS_ENABLED = 'true';
    mockTrackAdRevenue.mockRejectedValueOnce(new Error('RevenueCat unavailable'));
    await expect(
      trackAdRevenueToRevenueCat({
        adUnitId: 'test-ad-unit',
        paidEvent: { value: 0.01, currency: 'EUR', precision: RevenuePrecisions.PRECISE },
      }),
    ).resolves.toBeUndefined();
    expect(mockTrackAdRevenue).toHaveBeenCalledTimes(1);
  });
});
