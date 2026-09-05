import { renderHook } from '@testing-library/react-native';
import type { PurchasesPackage } from 'react-native-purchases';

import { packagesForEntitlement } from '@/lib/purchases';
import { usePaywall } from './use-paywall';

jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => ({ refresh: jest.fn().mockResolvedValue(undefined) }),
}));

jest.mock('@/lib/analytics', () => ({
  trackAnalyticsEvent: jest.fn(),
}));

jest.mock('@/lib/purchases', () => ({
  ENTITLEMENT_IDS: { PLUS: 'Plus', AI: 'AI' },
  buyPackage: jest.fn(),
  packagesForEntitlement: jest.fn(),
  restorePurchases: jest.fn(),
}));

const mockPackagesForEntitlement = jest.mocked(packagesForEntitlement);

describe('usePaywall', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads packages even when the provider initializes RevenueCat in a parent effect', async () => {
    const annualPackage = {
      identifier: '$rc_annual',
      packageType: 'ANNUAL',
      product: {
        price: 44.99,
        priceString: '44,99 €',
        currencyCode: 'EUR',
      },
    } as unknown as PurchasesPackage;
    mockPackagesForEntitlement.mockResolvedValueOnce([annualPackage]);

    const { result } = await renderHook(() => usePaywall('plus'));

    expect(mockPackagesForEntitlement).toHaveBeenCalledWith('Plus');
    expect(result.current.plans.yearly.package).toBe(annualPackage);
  });
});
