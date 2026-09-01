import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import Purchases from 'react-native-purchases';

import {
  buyPackage,
  checkEntitlementVerification,
  ENTITLEMENT_IDS,
  ENTITLEMENT_VERIFICATION_MODE,
  hasAIEntitlement,
  hasEntitlement,
  hasPlusEntitlement,
  initPurchases,
  isPurchasesConfigured,
  OFFERING_IDS,
  offeringForEntitlement,
  PACKAGE_IDS,
  packagesForEntitlement,
  restorePurchases,
  selectRevenueCatApiKey,
  VERIFICATION_RESULT,
} from './purchases';

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    setLogHandler: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    getOfferings: jest.fn(),
  },
  LOG_LEVEL: { DEBUG: 'DEBUG' },
  ENTITLEMENT_VERIFICATION_MODE: {
    DISABLED: 'DISABLED',
    INFORMATIONAL: 'INFORMATIONAL',
  },
  VERIFICATION_RESULT: {
    NOT_REQUESTED: 'NOT_REQUESTED',
    VERIFIED: 'VERIFIED',
    FAILED: 'FAILED',
    VERIFIED_ON_DEVICE: 'VERIFIED_ON_DEVICE',
  },
}));

jest.mock('@/lib/env', () => ({
  env: {
    revenueCatTestStoreApiKey: 'test_12345',
    revenueCatApiKeyIos: 'appl_12345',
    revenueCatApiKeyAndroid: 'goog_12345',
  },
}));

describe('purchases security and entitlement checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initPurchases', () => {
    it('initializes with INFORMATIONAL entitlement verification mode', () => {
      initPurchases();
      expect(Purchases.configure).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test_12345',
          entitlementVerificationMode: ENTITLEMENT_VERIFICATION_MODE.INFORMATIONAL,
        }),
      );
      expect(isPurchasesConfigured()).toBe(true);
    });
  });

  describe('RevenueCat API key selection', () => {
    it('prefers a test store key only in development', () => {
      expect(
        selectRevenueCatApiKey({
          isDev: true,
          platform: 'ios',
          testStoreApiKey: 'test_development',
          iosApiKey: 'appl_production',
          androidApiKey: 'goog_production',
        }),
      ).toBe('test_development');

      expect(
        selectRevenueCatApiKey({
          isDev: false,
          platform: 'ios',
          testStoreApiKey: 'test_development',
          iosApiKey: 'appl_production',
          androidApiKey: 'goog_production',
        }),
      ).toBe('appl_production');
    });

    it('fails closed when a release platform receives the wrong key type', () => {
      expect(
        selectRevenueCatApiKey({
          isDev: false,
          platform: 'ios',
          testStoreApiKey: undefined,
          iosApiKey: 'test_not_for_testflight',
          androidApiKey: 'goog_production',
        }),
      ).toBeUndefined();

      expect(
        selectRevenueCatApiKey({
          isDev: false,
          platform: 'android',
          testStoreApiKey: undefined,
          iosApiKey: 'appl_production',
          androidApiKey: 'appl_wrong_platform',
        }),
      ).toBeUndefined();
    });
  });

  describe('checkEntitlementVerification', () => {
    it('returns true for null customerInfo', () => {
      expect(checkEntitlementVerification(null)).toBe(true);
    });

    it('returns true for VERIFIED customerInfo', () => {
      const customerInfo = {
        entitlements: {
          verification: VERIFICATION_RESULT.VERIFIED,
          all: {},
          active: {},
        },
      } as unknown as CustomerInfo;

      expect(checkEntitlementVerification(customerInfo)).toBe(true);
    });

    it('warns and returns false for FAILED verification', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const customerInfo = {
        entitlements: {
          verification: VERIFICATION_RESULT.FAILED,
          all: {},
          active: {},
        },
      } as unknown as CustomerInfo;

      expect(checkEntitlementVerification(customerInfo)).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Entitlement-Verifikation fehlgeschlagen'),
      );

      warnSpy.mockRestore();
    });
  });

  describe('hasEntitlement', () => {
    it('returns false when customerInfo is null', () => {
      expect(hasEntitlement(null, ENTITLEMENT_IDS.PLUS)).toBe(false);
    });

    it('distinguishes independently active Plus and AI entitlements', () => {
      const customerInfo = {
        entitlements: {
          verification: VERIFICATION_RESULT.VERIFIED,
          all: {},
          active: {
            [ENTITLEMENT_IDS.AI]: {
              identifier: ENTITLEMENT_IDS.AI,
              isActive: true,
            },
          },
        },
      } as unknown as CustomerInfo;

      expect(hasPlusEntitlement(customerInfo)).toBe(false);
      expect(hasAIEntitlement(customerInfo)).toBe(true);
    });

    it('does not accept the legacy Premium entitlement as a fallback', () => {
      const customerInfo = {
        entitlements: {
          verification: VERIFICATION_RESULT.VERIFIED,
          all: {},
          active: {
            Premium: {
              identifier: 'Premium',
              isActive: true,
            },
          },
        },
      } as unknown as CustomerInfo;

      expect(hasPlusEntitlement(customerInfo)).toBe(false);
      expect(hasAIEntitlement(customerInfo)).toBe(false);
    });

    it('fails closed when RevenueCat marks CustomerInfo verification as failed', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const customerInfo = {
        entitlements: {
          verification: VERIFICATION_RESULT.FAILED,
          all: {},
          active: {
            [ENTITLEMENT_IDS.PLUS]: {
              identifier: ENTITLEMENT_IDS.PLUS,
              isActive: true,
            },
          },
        },
      } as unknown as CustomerInfo;

      expect(hasPlusEntitlement(customerInfo)).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('targeted offerings', () => {
    it('resolves Plus and AI independently instead of using the current offering', async () => {
      const plusPackages = [{ identifier: PACKAGE_IDS.MONTHLY }];
      const aiPackages = [{ identifier: PACKAGE_IDS.ANNUAL }];
      (Purchases.getOfferings as jest.Mock).mockResolvedValue({
        current: { identifier: 'default', availablePackages: [] },
        all: {
          [OFFERING_IDS.PLUS]: {
            identifier: OFFERING_IDS.PLUS,
            availablePackages: plusPackages,
          },
          [OFFERING_IDS.AI]: {
            identifier: OFFERING_IDS.AI,
            availablePackages: aiPackages,
          },
        },
      });

      expect(await packagesForEntitlement(ENTITLEMENT_IDS.PLUS)).toBe(plusPackages);
      expect(await packagesForEntitlement(ENTITLEMENT_IDS.AI)).toBe(aiPackages);
      expect(Purchases.getOfferings).toHaveBeenCalledTimes(2);
    });

    it('returns null and an empty package list when the targeted offering is unavailable', async () => {
      (Purchases.getOfferings as jest.Mock).mockResolvedValue({ current: null, all: {} });

      expect(await offeringForEntitlement(ENTITLEMENT_IDS.AI)).toBeNull();
      expect(await packagesForEntitlement(ENTITLEMENT_IDS.AI)).toEqual([]);
    });
  });

  describe('buyPackage outcome handling', () => {
    it('returns purchased kind on success', async () => {
      const mockCustomerInfo = { entitlements: { active: {} } } as CustomerInfo;
      (Purchases.purchasePackage as jest.Mock).mockResolvedValueOnce({
        customerInfo: mockCustomerInfo,
      });

      const outcome = await buyPackage({
        identifier: '$rc_monthly',
      } as unknown as PurchasesPackage);
      expect(outcome).toEqual({
        kind: 'purchased',
        customerInfo: mockCustomerInfo,
      });
    });

    it('returns cancelled kind when user cancelled', async () => {
      (Purchases.purchasePackage as jest.Mock).mockRejectedValueOnce({
        userCancelled: true,
        message: 'User cancelled',
      });

      const outcome = await buyPackage({
        identifier: '$rc_monthly',
      } as unknown as PurchasesPackage);
      expect(outcome).toEqual({ kind: 'cancelled' });
    });

    it('returns failed kind when an error occurred', async () => {
      const error = { userCancelled: false, message: 'Store error', code: 1 };
      (Purchases.purchasePackage as jest.Mock).mockRejectedValueOnce(error);

      const outcome = await buyPackage({
        identifier: '$rc_monthly',
      } as unknown as PurchasesPackage);
      expect(outcome).toEqual({ kind: 'failed', error });
    });
  });

  describe('restorePurchases', () => {
    it('returns ok with customerInfo on success', async () => {
      const mockCustomerInfo = { entitlements: { active: {} } } as CustomerInfo;
      (Purchases.restorePurchases as jest.Mock).mockResolvedValueOnce(mockCustomerInfo);

      const result = await restorePurchases();
      expect(result).toEqual({ ok: true, customerInfo: mockCustomerInfo });
    });

    it('returns ok: false on error', async () => {
      const error = new Error('Restore failed');
      (Purchases.restorePurchases as jest.Mock).mockRejectedValueOnce(error);

      const result = await restorePurchases();
      expect(result).toEqual({ ok: false, error });
    });
  });
});
