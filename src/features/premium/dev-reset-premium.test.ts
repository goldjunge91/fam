import type { QueryClient } from '@tanstack/react-query';
import Purchases from 'react-native-purchases';
import {
  useForceAiOverrideStore,
  useForcePremiumOverrideStore,
} from '@/features/premium/force-premium-override';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import { getDatabase } from '@/lib/db/local-client';
import { debugWarn } from '@/lib/observability/debug-log';
import { devResetHouseholdPremium } from './dev-reset-premium';

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    invalidateCustomerInfoCache: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: jest.fn(),
}));

jest.mock('@/lib/observability/debug-log', () => ({
  debugWarn: jest.fn(),
}));

describe('devResetHouseholdPremium', () => {
  let mockRunAsync: jest.Mock;
  let mockSupabaseUpdate: jest.Mock;
  let mockSupabaseEq: jest.Mock;
  let mockQueryClient: { invalidateQueries: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    mockRunAsync = jest.fn().mockResolvedValue({ changes: 1 });
    (getDatabase as jest.Mock).mockResolvedValue({
      runAsync: mockRunAsync,
    });

    mockSupabaseEq = jest.fn().mockResolvedValue({ error: null });
    mockSupabaseUpdate = jest.fn().mockReturnValue({ eq: mockSupabaseEq });
    (getSupabase as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        update: mockSupabaseUpdate,
      }),
    });

    mockQueryClient = { invalidateQueries: jest.fn() };
  });

  it('setzt Plus und KI in SQLite, Supabase und Overrides zurück', async () => {
    useForcePremiumOverrideStore.getState().setOverride(true);
    useForceAiOverrideStore.getState().setOverride(true);

    await devResetHouseholdPremium({
      householdId: 'hh-test-1',
      userId: 'user-test-1',
      queryClient: mockQueryClient as unknown as QueryClient,
    });

    // Overrides sollten null sein
    expect(useForcePremiumOverrideStore.getState().override).toBeNull();
    expect(useForceAiOverrideStore.getState().override).toBeNull();

    // Supabase Update
    expect(mockSupabaseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        plus_active: false,
        ai_active: false,
        plus_expires_at: null,
        ai_expires_at: null,
        ai_subscriber_id: null,
      }),
    );
    expect(mockSupabaseEq).toHaveBeenCalledWith('id', 'hh-test-1');

    // SQLite Update
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('set plus_active = 0'), [
      'hh-test-1',
    ]);

    // RevenueCat Cache
    expect(Purchases.invalidateCustomerInfoCache).toHaveBeenCalled();

    // React Query Invalidation
    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['households', 'by-user', 'user-test-1'],
    });
  });

  it('setzt lokale Overrides zurück und fährt bei Backendfehlern fort', async () => {
    useForcePremiumOverrideStore.getState().setOverride(true);
    useForceAiOverrideStore.getState().setOverride(true);
    jest.mocked(getSupabase).mockImplementation(() => {
      throw new Error('remote unavailable');
    });
    jest.mocked(getDatabase).mockRejectedValue(new Error('local unavailable'));
    jest
      .mocked(Purchases.invalidateCustomerInfoCache)
      .mockRejectedValue(new Error('cache unavailable'));

    await expect(
      devResetHouseholdPremium({
        householdId: 'hh-offline',
        queryClient: mockQueryClient as unknown as QueryClient,
      }),
    ).resolves.toBeUndefined();

    expect(useForcePremiumOverrideStore.getState().override).toBeNull();
    expect(useForceAiOverrideStore.getState().override).toBeNull();
    expect(debugWarn).toHaveBeenCalledTimes(3);
    expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled();
  });
});
