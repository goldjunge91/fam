import type { CustomerInfo } from 'react-native-purchases';
import { hasAIEntitlement } from '@/lib/backend/revenuecat';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import { debugWarn } from '@/lib/observability/debug-log';
import { syncRevenueCatAiEntitlement } from './revenuecat-entitlement-sync';

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: jest.fn(),
}));
jest.mock('@/lib/backend/revenuecat', () => ({
  hasAIEntitlement: jest.fn(),
}));
jest.mock('@/lib/observability/debug-log', () => ({
  debugWarn: jest.fn(),
}));

const mockGetSupabase = jest.mocked(getSupabase);
const mockHasAIEntitlement = jest.mocked(hasAIEntitlement);
const mockDebugWarn = jest.mocked(debugWarn);

function customerInfo(): CustomerInfo {
  return { entitlements: { active: {} } } as CustomerInfo;
}

describe('syncRevenueCatAiEntitlement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends the active AI entitlement and returns the server status', async () => {
    const invoke = jest.fn().mockResolvedValue({ data: { active: true }, error: null });
    mockGetSupabase.mockReturnValue({ functions: { invoke } } as never);
    mockHasAIEntitlement.mockReturnValue(true);

    const info = customerInfo();
    const active = { expirationDate: '2026-12-01T00:00:00.000Z' };
    info.entitlements.active.AI = active as never;

    await expect(syncRevenueCatAiEntitlement('household-1', info)).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledWith('revenuecat-entitlement-sync', {
      body: {
        householdId: 'household-1',
        localEntitlement: { active: true, expiresAt: active.expirationDate },
      },
    });
  });

  it('sends inactive state when the customer has no AI entitlement', async () => {
    const invoke = jest.fn().mockResolvedValue({ data: { active: false }, error: null });
    mockGetSupabase.mockReturnValue({ functions: { invoke } } as never);
    mockHasAIEntitlement.mockReturnValue(false);

    await expect(syncRevenueCatAiEntitlement(null, customerInfo())).resolves.toBe(false);
    expect(invoke).toHaveBeenCalledWith('revenuecat-entitlement-sync', {
      body: {
        householdId: null,
        localEntitlement: { active: false, expiresAt: null },
      },
    });
  });

  it('returns false and logs invocation errors', async () => {
    const error = new Error('function failed');
    mockGetSupabase.mockReturnValue({
      functions: { invoke: jest.fn().mockResolvedValue({ data: null, error }) },
    } as never);
    mockHasAIEntitlement.mockReturnValue(false);

    await expect(syncRevenueCatAiEntitlement('household-1', customerInfo())).resolves.toBe(false);
    expect(mockDebugWarn).toHaveBeenCalledWith(
      '[Premium] RevenueCat-AI-Status konnte nicht synchronisiert werden:',
      error,
    );
  });

  it('returns false when the response is malformed or invocation throws', async () => {
    mockGetSupabase.mockReturnValue({
      functions: { invoke: jest.fn().mockResolvedValue({ data: { active: 'yes' }, error: null }) },
    } as never);
    mockHasAIEntitlement.mockReturnValue(false);
    await expect(syncRevenueCatAiEntitlement('household-1', customerInfo())).resolves.toBe(false);

    const error = new Error('network failed');
    mockGetSupabase.mockReturnValue({
      functions: { invoke: jest.fn().mockRejectedValue(error) },
    } as never);
    await expect(syncRevenueCatAiEntitlement('household-1', customerInfo())).resolves.toBe(false);
    expect(mockDebugWarn).toHaveBeenCalledWith(
      '[Premium] RevenueCat-AI-Status konnte nicht synchronisiert werden:',
      error,
    );
  });
});
