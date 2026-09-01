import { AdMediatorName } from 'react-native-purchases';

import { initMobileAds, trackAdRevenueToRevenueCat } from './ads-service';

let mockPurchasesConfigured = false;
const mockTrackAdRevenue = jest.fn();

jest.mock('@/lib/purchases', () => ({
  isPurchasesConfigured: () => mockPurchasesConfigured,
}));

jest.mock('react-native-google-mobile-ads', () => ({
  __esModule: true,
  default: () => ({
    initialize: jest.fn().mockResolvedValue([]),
  }),
  AdsConsent: {
    gatherConsent: jest.fn().mockResolvedValue({ canRequestAds: true }),
    getConsentInfo: jest.fn().mockResolvedValue({ canRequestAds: true }),
    getGdprApplies: jest.fn().mockResolvedValue(false),
  },
  RevenuePrecisions: {
    PRECISE: 1,
    ESTIMATED: 2,
    PUBLISHER_PROVIDED: 3,
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
  beforeEach(() => {
    mockPurchasesConfigured = false;
    jest.clearAllMocks();
  });

  it('initMobileAds initialisiert ohne Fehler', async () => {
    await expect(initMobileAds()).resolves.toBeUndefined();
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
        currency: 'EUR',
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
});
