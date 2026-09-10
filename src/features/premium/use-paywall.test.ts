import { act, renderHook } from '@testing-library/react-native';
import type { PurchasesPackage } from 'react-native-purchases';

import { buyPackage, packagesForEntitlement, restorePurchases } from '@/lib/purchases';
import { pollHouseholdUntilEntitlementActive } from './household-entitlement-sync';
import { usePaywall } from './use-paywall';

jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => ({ refresh: jest.fn().mockResolvedValue(undefined) }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-123' } } }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useOptionalActiveHousehold: () => ({ activeHouseholdId: 'hh-abc' }),
}));

jest.mock('./household-entitlement-sync', () => ({
  pollHouseholdUntilEntitlementActive: jest.fn().mockResolvedValue(true),
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
const mockBuyPackage = jest.mocked(buyPackage);
const mockRestorePurchases = jest.mocked(restorePurchases);
const mockPollHousehold = jest.mocked(pollHouseholdUntilEntitlementActive);

describe('usePaywall', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPackagesForEntitlement.mockResolvedValue([]);
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

  it('stößt nach erfolgreichem Kauf den schnellen Haushaltsabgleich an', async () => {
    const annualPackage = {
      identifier: '$rc_annual',
      packageType: 'ANNUAL',
      product: { price: 44.99, priceString: '44,99 €', currencyCode: 'EUR' },
    } as unknown as PurchasesPackage;
    mockPackagesForEntitlement.mockResolvedValueOnce([annualPackage]);
    mockBuyPackage.mockResolvedValueOnce({
      kind: 'purchased',
      customerInfo: {} as never,
    });

    const { result } = await renderHook(() => usePaywall('plus'));

    await act(async () => {
      const outcome = await result.current.buySelectedPlan();
      expect(outcome.kind).toBe('purchased');
    });

    expect(mockBuyPackage).toHaveBeenCalledWith(annualPackage);
    expect(mockPollHousehold).toHaveBeenCalledWith({
      tier: 'plus',
      userId: 'user-123',
      activeHouseholdId: 'hh-abc',
    });
  });

  it('stößt nach erfolgreichem Restore den schnellen Haushaltsabgleich an', async () => {
    mockRestorePurchases.mockResolvedValueOnce({
      ok: true,
      customerInfo: {} as never,
    });

    const { result } = await renderHook(() => usePaywall('ai'));

    await act(async () => {
      const outcome = await result.current.restore();
      expect(outcome.ok).toBe(true);
    });

    expect(mockRestorePurchases).toHaveBeenCalled();
    expect(mockPollHousehold).toHaveBeenCalledWith({
      tier: 'ai',
      userId: 'user-123',
      activeHouseholdId: 'hh-abc',
    });
  });
});
