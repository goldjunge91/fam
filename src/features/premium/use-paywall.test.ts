import { act, renderHook } from '@testing-library/react-native';
import type { PurchasesPackage } from 'react-native-purchases';

import { buyPackage, packagesForEntitlement, restorePurchases } from '@/lib/backend/revenuecat';
import { pollHouseholdUntilEntitlementActive } from './household-entitlement-sync';
import { syncRevenueCatAiEntitlement } from './revenuecat-entitlement-sync';
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

jest.mock('./revenuecat-entitlement-sync', () => ({
  syncRevenueCatAiEntitlement: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/analytics', () => ({
  trackAnalyticsEvent: jest.fn(),
}));

jest.mock('@/lib/backend/revenuecat', () => ({
  ENTITLEMENT_IDS: { PLUS: 'Plus', AI: 'AI' },
  buyPackage: jest.fn(),
  packagesForEntitlement: jest.fn(),
  restorePurchases: jest.fn(),
}));

const mockPackagesForEntitlement = jest.mocked(packagesForEntitlement);
const mockBuyPackage = jest.mocked(buyPackage);
const mockRestorePurchases = jest.mocked(restorePurchases);
const mockPollHousehold = jest.mocked(pollHouseholdUntilEntitlementActive);
const mockSyncAiEntitlement = jest.mocked(syncRevenueCatAiEntitlement);

describe('usePaywall', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPackagesForEntitlement.mockResolvedValue([]);
    mockPollHousehold.mockResolvedValue(true);
    mockSyncAiEntitlement.mockResolvedValue(true);
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
      expect(outcome).toEqual(
        expect.objectContaining({
          activation: {
            aiEntitlementSynced: null,
            householdEntitlementActive: true,
            confirmed: true,
          },
        }),
      );
    });

    expect(mockBuyPackage).toHaveBeenCalledWith(annualPackage);
    expect(mockPollHousehold).toHaveBeenCalledWith({
      tier: 'plus',
      userId: 'user-123',
      activeHouseholdId: 'hh-abc',
    });
  });

  it('returns unavailable when the selected period has no package', async () => {
    const { result } = await renderHook(() => usePaywall('ai'));

    await act(async () => {
      await expect(result.current.buySelectedPlan()).resolves.toEqual({ kind: 'unavailable' });
    });
    expect(mockBuyPackage).not.toHaveBeenCalled();
  });

  it.each([
    { kind: 'cancelled' as const },
    {
      kind: 'failed' as const,
      error: { code: 'store_problem', message: 'store failed' },
    },
  ])('handles a non-purchased outcome: $kind', async (outcome) => {
    const annualPackage = {
      identifier: '$rc_annual',
      packageType: 'ANNUAL',
      product: { price: 44.99, priceString: '44,99 €', currencyCode: 'EUR' },
    } as unknown as PurchasesPackage;
    mockPackagesForEntitlement.mockResolvedValueOnce([annualPackage]);
    mockBuyPackage.mockResolvedValueOnce(outcome as never);

    const { result } = await renderHook(() => usePaywall('ai'));
    await act(async () => {
      await result.current.buySelectedPlan();
    });

    expect(mockPollHousehold).not.toHaveBeenCalled();
  });

  it('returns a failed restore result without polling', async () => {
    const error = new Error('restore failed');
    mockRestorePurchases.mockResolvedValueOnce({ ok: false, error });

    const { result } = await renderHook(() => usePaywall('ai'));
    await expect(act(async () => result.current.restore())).resolves.toEqual({ ok: false, error });
    expect(mockPollHousehold).not.toHaveBeenCalled();
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
      expect(outcome).toEqual(
        expect.objectContaining({
          activation: {
            aiEntitlementSynced: true,
            householdEntitlementActive: true,
            confirmed: true,
          },
        }),
      );
    });

    expect(mockRestorePurchases).toHaveBeenCalled();
    expect(mockPollHousehold).toHaveBeenCalledWith({
      tier: 'ai',
      userId: 'user-123',
      activeHouseholdId: 'hh-abc',
    });
  });
});
