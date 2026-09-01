import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import Purchases from 'react-native-purchases';

import {
  buyPackage,
  checkEntitlementVerification,
  ENTITLEMENT_VERIFICATION_MODE,
  hasPremiumEntitlement,
  initPurchases,
  isPurchasesConfigured,
  PREMIUM_ENTITLEMENT_ID,
  restorePurchases,
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

  describe('hasPremiumEntitlement', () => {
    it('returns false when customerInfo is null', () => {
      expect(hasPremiumEntitlement(null)).toBe(false);
    });

    it('returns true when PREMIUM_ENTITLEMENT_ID is in active entitlements', () => {
      const customerInfo = {
        entitlements: {
          verification: VERIFICATION_RESULT.VERIFIED,
          all: {},
          active: {
            [PREMIUM_ENTITLEMENT_ID]: {
              identifier: PREMIUM_ENTITLEMENT_ID,
              isActive: true,
            },
          },
        },
      } as unknown as CustomerInfo;

      expect(hasPremiumEntitlement(customerInfo)).toBe(true);
    });

    it('returns false when PREMIUM_ENTITLEMENT_ID is missing from active entitlements', () => {
      const customerInfo = {
        entitlements: {
          verification: VERIFICATION_RESULT.VERIFIED,
          all: {},
          active: {},
        },
      } as unknown as CustomerInfo;

      expect(hasPremiumEntitlement(customerInfo)).toBe(false);
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
