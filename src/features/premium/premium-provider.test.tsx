import { renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';

import { PremiumProvider, usePremium } from '@/features/premium/premium-provider';
import {
  isPurchasesConfigured,
  resetPurchasesIdentity,
  setPurchasesEmail,
  syncPurchasesIdentity,
} from '@/lib/purchases';

let mockActiveHousehold: { id: string; premium_active: boolean } | null = null;
let mockSession: { user: { id: string; email?: string } } | null = null;

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({
    activeHouseholdId: 'hh-1',
    activeHousehold: mockActiveHousehold,
  }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({
    session: mockSession,
    isLoading: false,
    seenOnboarding: true,
  }),
}));

jest.mock('@/lib/purchases', () => ({
  isPurchasesConfigured: jest.fn(),
  hasPremiumEntitlement: jest.fn().mockReturnValue(false),
  initPurchases: jest.fn(),
  syncPurchasesIdentity: jest.fn().mockResolvedValue(null),
  resetPurchasesIdentity: jest.fn().mockResolvedValue(null),
  setPurchasesAttributes: jest.fn().mockResolvedValue(undefined),
  setPurchasesEmail: jest.fn().mockResolvedValue(undefined),
}));

describe('PremiumProvider', () => {
  function wrapper({ children }: { children: React.ReactNode }) {
    return <PremiumProvider>{children}</PremiumProvider>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (isPurchasesConfigured as jest.Mock).mockReturnValue(false);
    mockActiveHousehold = null;
    mockSession = null;
  });

  it('erkennt aktiven Haushalt-Status ueber die Datenbank', async () => {
    mockActiveHousehold = { id: 'hh-1', premium_active: true };

    const { result } = await renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isPremium).toBe(true);
  });

  it('gibt false zurueck wenn kein aktives Abo fuer den Haushalt vorliegt', async () => {
    mockActiveHousehold = { id: 'hh-1', premium_active: false };

    const { result } = await renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isPremium).toBe(false);
  });

  it('synchronisiert User-ID und Attribute mit RevenueCat wenn konfiguriert und eingeloggt', async () => {
    (isPurchasesConfigured as jest.Mock).mockReturnValue(true);
    mockSession = { user: { id: 'user-123', email: 'test@fam.app' } };
    mockActiveHousehold = { id: 'hh-1', premium_active: false };

    const { result } = await renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(syncPurchasesIdentity).toHaveBeenCalledWith('user-123', {
        household_id: 'hh-1',
        $posthogUserId: 'user-123',
      });
      expect(setPurchasesEmail).toHaveBeenCalledWith('test@fam.app');
    });

    expect(result.current.loading).toBe(false);
  });

  it('resettet RevenueCat-Identitaet wenn kein User eingeloggt ist', async () => {
    (isPurchasesConfigured as jest.Mock).mockReturnValue(true);
    mockSession = null;

    const { result } = await renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(resetPurchasesIdentity).toHaveBeenCalled();
    });

    expect(result.current.loading).toBe(false);
  });
});
