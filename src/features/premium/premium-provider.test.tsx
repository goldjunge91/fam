import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { StrictMode } from 'react';
import Purchases, { type CustomerInfo } from 'react-native-purchases';

import { PremiumProvider, usePremium } from '@/features/premium/premium-provider';
import {
  hasPlusEntitlement,
  isPurchasesConfigured,
  resetPurchasesIdentity,
  setPurchasesEmail,
  syncPurchasesIdentity,
} from '@/lib/purchases';

let mockActiveHousehold: { id: string; plus_active: boolean; ai_active?: boolean } | null = null;
let mockSession: { user: { id: string; email?: string } } | null = null;
let mockCustomerInfoListener: ((info: CustomerInfo) => void) | null = null;

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
    getCustomerInfo: jest.fn(),
    getAppUserID: jest.fn(),
  },
}));

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
  hasPlusEntitlement: jest.fn().mockReturnValue(false),
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
    jest.resetAllMocks();
    (isPurchasesConfigured as jest.Mock).mockReturnValue(false);
    (hasPlusEntitlement as jest.Mock).mockReturnValue(false);
    mockActiveHousehold = null;
    mockSession = null;
    mockCustomerInfoListener = null;
    (Purchases.addCustomerInfoUpdateListener as jest.Mock).mockImplementation(
      (listener: (info: CustomerInfo) => void) => {
        mockCustomerInfoListener = listener;
      },
    );
    (Purchases.getAppUserID as jest.Mock).mockImplementation(
      async () => mockSession?.user.id ?? '$RCAnonymousID',
    );
  });

  it('erkennt aktiven Haushalt-Status ueber die Datenbank', async () => {
    mockActiveHousehold = { id: 'hh-1', plus_active: true };

    const { result } = await renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasPlus).toBe(true);
  });

  it('gibt false zurueck wenn kein aktives Abo fuer den Haushalt vorliegt', async () => {
    mockActiveHousehold = { id: 'hh-1', plus_active: false };

    const { result } = await renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasPlus).toBe(false);
  });

  it('verwendet ein persoenliches Plus-Entitlement nicht als Haushaltsfreigabe', async () => {
    (hasPlusEntitlement as jest.Mock).mockReturnValue(true);
    mockActiveHousehold = { id: 'hh-1', plus_active: false };

    const { result } = await renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasPlus).toBe(false);
  });

  it('prueft AI unabhaengig von Plus ueber den Haushalt', async () => {
    mockActiveHousehold = { id: 'hh-1', plus_active: false, ai_active: true };

    const { result } = await renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasAI).toBe(true);
    expect(result.current.hasPlus).toBe(false);
  });

  it('erlaubt Plus und AI gleichzeitig aktiv', async () => {
    mockActiveHousehold = { id: 'hh-1', plus_active: true, ai_active: true };

    const { result } = await renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasPlus).toBe(true);
    expect(result.current.hasAI).toBe(true);
  });

  it('aktualisiert Plus/AI beim Haushaltswechsel', async () => {
    mockActiveHousehold = { id: 'hh-1', plus_active: true, ai_active: false };

    const { result, rerender } = await renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.hasPlus).toBe(true);
    });
    expect(result.current.hasAI).toBe(false);

    mockActiveHousehold = { id: 'hh-2', plus_active: false, ai_active: true };
    await rerender({});

    expect(result.current.hasPlus).toBe(false);
    expect(result.current.hasAI).toBe(true);
  });

  it('synchronisiert User-ID und Attribute mit RevenueCat wenn konfiguriert und eingeloggt', async () => {
    (isPurchasesConfigured as jest.Mock).mockReturnValue(true);
    mockSession = { user: { id: 'user-123', email: 'test@fam.app' } };
    mockActiveHousehold = { id: 'hh-1', plus_active: false };

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

  it('bleibt unter StrictMode-Effect-Replay aktiv', async () => {
    (isPurchasesConfigured as jest.Mock).mockReturnValue(true);
    mockSession = { user: { id: 'user-strict' } };
    const strictInfo = { entitlements: { active: {} } } as unknown as CustomerInfo;
    (syncPurchasesIdentity as jest.Mock).mockResolvedValueOnce(strictInfo);

    const strictWrapper = ({ children }: { children: React.ReactNode }) => (
      <StrictMode>
        <PremiumProvider>{children}</PremiumProvider>
      </StrictMode>
    );
    const { result } = await renderHook(() => usePremium(), { wrapper: strictWrapper });

    await waitFor(() => {
      expect(result.current.customerInfo).toBe(strictInfo);
      expect(result.current.loading).toBe(false);
    });
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

  it('raeumt customerInfo sofort auf, wenn ein anderer User eingeloggt wird', async () => {
    (isPurchasesConfigured as jest.Mock).mockReturnValue(true);
    mockSession = { user: { id: 'user-1', email: 'a@fam.app' } };
    mockActiveHousehold = { id: 'hh-1', plus_active: false };

    const userOneInfo = {
      entitlements: { active: { Plus: { identifier: 'Plus', isActive: true } } },
    } as unknown as CustomerInfo;
    (syncPurchasesIdentity as jest.Mock).mockResolvedValueOnce(userOneInfo);

    const { result, rerender } = await renderHook(() => usePremium(), { wrapper });

    await waitFor(() => {
      expect(result.current.customerInfo).toBe(userOneInfo);
    });

    // Account-Wechsel: der Identitaetsabgleich fuer den neuen User ist noch nicht abgeschlossen.
    let resolveUserTwoSync: (info: CustomerInfo | null) => void = () => {};
    (syncPurchasesIdentity as jest.Mock).mockReturnValueOnce(
      new Promise<CustomerInfo | null>((resolve) => {
        resolveUserTwoSync = resolve;
      }),
    );
    mockSession = { user: { id: 'user-2', email: 'b@fam.app' } };
    await rerender({});

    expect(result.current.customerInfo).toBeNull();

    resolveUserTwoSync(null);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('ignoriert eine spaet aufloesende Identitaetssynchronisierung des vorherigen Accounts', async () => {
    (isPurchasesConfigured as jest.Mock).mockReturnValue(true);
    mockSession = { user: { id: 'user-1', email: 'a@fam.app' } };
    mockActiveHousehold = { id: 'hh-1', plus_active: false };

    let resolveUserOneSync: (info: CustomerInfo | null) => void = () => {};
    (syncPurchasesIdentity as jest.Mock).mockReturnValueOnce(
      new Promise<CustomerInfo | null>((resolve) => {
        resolveUserOneSync = resolve;
      }),
    );

    const { result, rerender } = await renderHook(() => usePremium(), { wrapper });

    // Account-Wechsel, bevor der Identitaetsabgleich von user-1 aufgeloest hat.
    const userTwoInfo = {
      entitlements: { active: {} },
    } as unknown as CustomerInfo;
    (syncPurchasesIdentity as jest.Mock).mockResolvedValueOnce(userTwoInfo);
    mockSession = { user: { id: 'user-2', email: 'b@fam.app' } };
    await rerender({});

    // Der neue Sync wartet seriell hinter dem noch laufenden alten Sync. Dessen
    // Ergebnis darf nach dem Account-Wechsel trotzdem nie sichtbar werden.
    expect(result.current.customerInfo).toBeNull();
    const userOneInfo = {
      entitlements: { active: { Plus: { identifier: 'Plus', isActive: true } } },
    } as unknown as CustomerInfo;
    await act(async () => {
      resolveUserOneSync(userOneInfo);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.customerInfo).toBe(userTwoInfo);
    });
    expect(result.current.customerInfo).not.toBe(userOneInfo);
  });

  it('ignoriert einen spaet aufloesenden Refresh des vorherigen Accounts', async () => {
    (isPurchasesConfigured as jest.Mock).mockReturnValue(true);
    mockSession = { user: { id: 'user-1', email: 'a@fam.app' } };
    mockActiveHousehold = { id: 'hh-1', plus_active: false };

    const userOneInfo = { entitlements: { active: {} } } as unknown as CustomerInfo;
    (syncPurchasesIdentity as jest.Mock).mockResolvedValueOnce(userOneInfo);

    const { result, rerender } = await renderHook(() => usePremium(), { wrapper });
    await waitFor(() => {
      expect(result.current.customerInfo).toBe(userOneInfo);
    });

    let resolveRefresh: (info: CustomerInfo) => void = () => {};
    (Purchases.getCustomerInfo as jest.Mock).mockReturnValueOnce(
      new Promise<CustomerInfo>((resolve) => {
        resolveRefresh = resolve;
      }),
    );
    const refreshPromise = result.current.refresh();

    const userTwoInfo = {
      entitlements: { active: { AI: { identifier: 'AI', isActive: true } } },
    } as unknown as CustomerInfo;
    (syncPurchasesIdentity as jest.Mock).mockResolvedValueOnce(userTwoInfo);
    mockSession = { user: { id: 'user-2', email: 'b@fam.app' } };
    await rerender({});
    await waitFor(() => {
      expect(result.current.customerInfo).toBe(userTwoInfo);
    });

    const staleInfo = {
      entitlements: { active: { Plus: { identifier: 'Plus', isActive: true } } },
    } as unknown as CustomerInfo;
    await act(async () => {
      resolveRefresh(staleInfo);
      await refreshPromise;
    });

    expect(result.current.customerInfo).toBe(userTwoInfo);
  });

  it('verwirft den Listener-Payload und liest CustomerInfo stabil fuer den aktuellen Account', async () => {
    (isPurchasesConfigured as jest.Mock).mockReturnValue(true);
    mockSession = { user: { id: 'user-2', email: 'b@fam.app' } };
    mockActiveHousehold = { id: 'hh-1', plus_active: false };

    const userTwoInfo = { entitlements: { active: {} } } as unknown as CustomerInfo;
    (syncPurchasesIdentity as jest.Mock).mockResolvedValueOnce(userTwoInfo);

    const { result } = await renderHook(() => usePremium(), { wrapper });
    await waitFor(() => {
      expect(result.current.customerInfo).toBe(userTwoInfo);
      expect(mockCustomerInfoListener).not.toBeNull();
    });

    const refreshedUserTwoInfo = {
      entitlements: { active: { AI: { identifier: 'AI', isActive: true } } },
    } as unknown as CustomerInfo;
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValueOnce(refreshedUserTwoInfo);
    (Purchases.getAppUserID as jest.Mock).mockResolvedValue('user-2');
    const staleInfo = {
      entitlements: { active: { Plus: { identifier: 'Plus', isActive: true } } },
    } as unknown as CustomerInfo;
    await act(async () => {
      mockCustomerInfoListener?.(staleInfo);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(Purchases.getCustomerInfo).toHaveBeenCalledTimes(1);
      expect(result.current.customerInfo).toBe(refreshedUserTwoInfo);
    });
    expect(result.current.customerInfo).not.toBe(staleInfo);
  });

  it('entfernt den CustomerInfo-Listener beim Unmount', async () => {
    (isPurchasesConfigured as jest.Mock).mockReturnValue(true);
    mockSession = { user: { id: 'user-1' } };

    const { unmount } = await renderHook(() => usePremium(), { wrapper });
    const listener = mockCustomerInfoListener;
    expect(listener).not.toBeNull();

    await unmount();

    expect(Purchases.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(listener);
  });
});
