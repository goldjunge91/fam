import { getDatabase } from '@/lib/db/client';
import { triggerHouseholdsPull } from '@/lib/sync/household-bootstrap-sync';
import { pollHouseholdUntilEntitlementActive } from './household-entitlement-sync';

jest.mock('@/lib/db/client', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('@/lib/sync/household-bootstrap-sync', () => ({
  triggerHouseholdsPull: jest.fn(),
}));

describe('pollHouseholdUntilEntitlementActive', () => {
  let mockGetAllAsync: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllAsync = jest.fn();
    (getDatabase as jest.Mock).mockResolvedValue({
      getAllAsync: mockGetAllAsync,
    });
    (triggerHouseholdsPull as jest.Mock).mockResolvedValue(null);
  });

  it('gibt false zurück, wenn keine userId angegeben ist', async () => {
    const result = await pollHouseholdUntilEntitlementActive({
      tier: 'plus',
      userId: '',
    });
    expect(result).toBe(false);
  });

  it('erkennt Plus-Aktivierung auf dem Zielhaushalt und beendet das Polling', async () => {
    mockGetAllAsync.mockResolvedValueOnce([{ id: 'hh-1', plus_active: 1, ai_active: 0 }]);

    const result = await pollHouseholdUntilEntitlementActive({
      tier: 'plus',
      userId: 'user-1',
      activeHouseholdId: 'hh-1',
      initialDelayMs: 0,
      maxWaitMs: 2000,
    });

    expect(result).toBe(true);
    expect(triggerHouseholdsPull).toHaveBeenCalledTimes(1);
  });

  it('erkennt KI-Aktivierung auf dem Zielhaushalt und beendet das Polling', async () => {
    mockGetAllAsync.mockResolvedValueOnce([{ id: 'hh-1', plus_active: 0, ai_active: 1 }]);

    const result = await pollHouseholdUntilEntitlementActive({
      tier: 'ai',
      userId: 'user-1',
      activeHouseholdId: 'hh-1',
      initialDelayMs: 0,
      maxWaitMs: 2000,
    });

    expect(result).toBe(true);
    expect(triggerHouseholdsPull).toHaveBeenCalledTimes(1);
  });

  it('wiederholt den Abgleich, wenn der Status zunächst inaktiv war, und liefert true sobald aktiv', async () => {
    mockGetAllAsync
      .mockResolvedValueOnce([{ id: 'hh-1', plus_active: 0, ai_active: 0 }])
      .mockResolvedValueOnce([{ id: 'hh-1', plus_active: 1, ai_active: 0 }]);

    const result = await pollHouseholdUntilEntitlementActive({
      tier: 'plus',
      userId: 'user-1',
      activeHouseholdId: 'hh-1',
      initialDelayMs: 0,
      pollIntervalMs: 10,
      maxWaitMs: 2000,
    });

    expect(result).toBe(true);
    expect(triggerHouseholdsPull).toHaveBeenCalledTimes(2);
  });

  it('bricht nach maxWaitMs ab und liefert false, wenn der Status inaktiv bleibt', async () => {
    mockGetAllAsync.mockResolvedValue([{ id: 'hh-1', plus_active: 0, ai_active: 0 }]);

    const result = await pollHouseholdUntilEntitlementActive({
      tier: 'plus',
      userId: 'user-1',
      activeHouseholdId: 'hh-1',
      initialDelayMs: 0,
      pollIntervalMs: 50,
      maxWaitMs: 120,
    });

    expect(result).toBe(false);
  });
});
