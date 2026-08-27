const mockPullHousehold = jest.fn();
const mockGetDatabase = jest.fn();
const mockGetSupabase = jest.fn();

jest.mock('@/lib/sync/pull', () => ({
  pullHousehold: (...args: unknown[]) => mockPullHousehold(...args),
}));

jest.mock('@/lib/db/client', () => ({
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
}));

jest.mock('@/lib/supabase', () => ({
  getSupabase: (...args: unknown[]) => mockGetSupabase(...args),
}));

// Dieser Unit-Test prueft den Haushalts-Pull, nicht das Sentry-SDK. Dessen
// Modulimport startet sonst einen dauerhaften Cleanup-Timer im Jest-Prozess.
jest.mock('@/lib/telemetry', () => ({
  reportError: jest.fn(),
}));

jest.mock('@/features/household/query-keys', () => ({
  householdsQueryKey: (userId: string | undefined) => ['households', 'by-user', userId] as const,
}));

import { triggerHouseholdsPull } from '@/lib/sync/household-bootstrap-sync';

function fakeQueryClient() {
  return { invalidateQueries: jest.fn() };
}

describe('triggerHouseholdsPull', () => {
  beforeEach(() => {
    mockPullHousehold.mockReset();
    mockGetDatabase.mockResolvedValue({});
    mockGetSupabase.mockReturnValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('pullt ausschliesslich die Entity households, unabhaengig von einem Haushalt', async () => {
    mockPullHousehold.mockResolvedValue([
      { entity: 'households', pagesFetched: 1, rowsWritten: 1, rowsSkippedAsLocalWins: 0 },
    ]);

    await triggerHouseholdsPull('user-1');

    expect(mockPullHousehold).toHaveBeenCalledTimes(1);
    const call = mockPullHousehold.mock.calls[0][0];
    expect(call.entities).toEqual(['households']);
    expect(call.householdIds).toEqual([]);
  });

  it('serialisiert nebenlaeufige Aufrufe ueber die eigene In-Flight-Sperre', async () => {
    let resolvePull: (value: unknown) => void = () => {};
    mockPullHousehold.mockReturnValue(
      new Promise((resolve) => {
        resolvePull = resolve;
      }),
    );

    const first = triggerHouseholdsPull('user-1');
    const second = triggerHouseholdsPull('user-1');

    expect(await second).toBeNull();
    resolvePull([
      { entity: 'households', pagesFetched: 1, rowsWritten: 0, rowsSkippedAsLocalWins: 0 },
    ]);
    await first;

    expect(mockPullHousehold).toHaveBeenCalledTimes(1);
  });

  it('invalidiert bei Erfolg die nutzerscoped households-Query', async () => {
    mockPullHousehold.mockResolvedValue([
      { entity: 'households', pagesFetched: 1, rowsWritten: 1, rowsSkippedAsLocalWins: 0 },
    ]);
    const queryClient = fakeQueryClient();

    // biome-ignore lint/suspicious/noExplicitAny: Test-Double, keine echte QueryClient-Instanz noetig
    await triggerHouseholdsPull('user-1', queryClient as any);

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['households', 'by-user', 'user-1'],
    });
  });

  it('ohne uebergebenen QueryClient bleibt das Verhalten unveraendert (kein Crash)', async () => {
    mockPullHousehold.mockResolvedValue([]);

    await expect(triggerHouseholdsPull('user-1')).resolves.not.toBeNull();
  });

  it('faengt einen fehlschlagenden Pull ab und gibt null zurueck', async () => {
    mockPullHousehold.mockRejectedValue(new Error('offline'));
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(triggerHouseholdsPull('user-1')).resolves.toBeNull();
    expect(consoleWarn).toHaveBeenCalledWith(
      '[HouseholdBootstrapSync] Pull fehlgeschlagen:',
      expect.objectContaining({ message: 'offline' }),
    );
  });
});
