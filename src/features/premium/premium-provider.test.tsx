import { renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';

import { PremiumProvider, usePremium } from '@/features/premium/premium-provider';

let mockActiveHousehold: { id: string; premium_active: boolean } | null = null;

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({
    activeHouseholdId: 'hh-1',
    activeHousehold: mockActiveHousehold,
  }),
}));

jest.mock('@/lib/purchases', () => ({
  isPurchasesConfigured: () => false,
  hasPremiumEntitlement: jest.fn().mockReturnValue(false),
  initPurchases: jest.fn(),
  listenToCustomerInfoUpdates: jest.fn(() => () => {}),
}));

describe('PremiumProvider', () => {
  function wrapper({ children }: { children: React.ReactNode }) {
    return <PremiumProvider>{children}</PremiumProvider>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
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
});
