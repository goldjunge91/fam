import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useSession } from '@/features/auth/session-provider';
import { useHouseholds } from '@/features/household/api';
import { resolveAppEntry } from '@/features/onboarding/domain/app-entry';
import { useHouseholdsBootstrapSync } from '@/lib/sync/household-bootstrap-sync';
import type { PullOutcome } from '@/lib/sync/pull';

const mockPullHousehold = jest.fn();
const mockReadHouseholds = jest.fn();
const mockDecision = jest.fn();
let mockReconnect: () => Promise<void>;

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } }, accountReady: true }),
}));
jest.mock('@/lib/db/local-client', () => ({
  getDatabase: async () => ({ getAllAsync: mockReadHouseholds }),
}));
jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: () => ({}),
  serverClock: { serverNowMs: () => null },
}));
jest.mock('@/lib/sync/pull', () => ({
  pullHousehold: (...args: unknown[]) => mockPullHousehold(...args),
}));
jest.mock('@/lib/sync/network-trigger', () => ({
  startNetworkReconnectTrigger: ({ onReconnect }: { onReconnect: typeof mockReconnect }) => {
    mockReconnect = onReconnect;
    return () => {};
  },
}));
jest.mock('@/lib/telemetry', () => ({ reportError: jest.fn() }));

const household = { id: 'hh-1', name: 'Unser Haushalt' };
const successfulPullOutcome: PullOutcome = {
  entity: 'households',
  pagesFetched: 1,
  rowsWritten: 1,
  rowsSkippedAsLocalWins: 0,
};
const successfulPull: PullOutcome[] = [successfulPullOutcome];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function EntryProbe() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const { data: households = [], isLoading, isError } = useHouseholds();
  const bootstrapState = useHouseholdsBootstrapSync(session?.user.id, queryClient);
  const decision = resolveAppEntry({
    hasSession: true,
    hasSeenOnboarding: true,
    shouldPromptOnboarding: false,
    householdCount: households.length,
    isLoading:
      isLoading || (!bootstrapState.isInitialSyncComplete && !bootstrapState.isInitialSyncError),
    householdsError: isError || bootstrapState.isInitialSyncError,
  });
  const destination = decision.kind === 'umleiten' ? decision.to : decision.kind;
  mockDecision(destination);
  return <Text>{destination}</Text>;
}

describe('Haushaltsentscheidung beim Kaltstart', () => {
  let queryClient: QueryClient;

  async function start() {
    await render(
      <QueryClientProvider client={queryClient}>
        <EntryProbe />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(mockReadHouseholds).toHaveBeenCalled());
  }

  beforeEach(() => {
    mockReadHouseholds.mockReset().mockResolvedValue([]);
    mockPullHousehold.mockReset();
    mockDecision.mockClear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 30_000, gcTime: Number.POSITIVE_INFINITY },
      },
    });
  });

  afterEach(() => queryClient.clear());

  it('wartet bei leerem Spiegel auf den Pull und dessen lokalen Refetch', async () => {
    const pull = deferred<PullOutcome[]>();
    const localRead = deferred<(typeof household)[]>();
    mockPullHousehold.mockReturnValue(pull.promise);
    await start();

    expect(screen.getByText('warten')).toBeOnTheScreen();
    mockReadHouseholds.mockReturnValue(localRead.promise);
    await act(async () => pull.resolve(successfulPull));
    await waitFor(() => expect(mockReadHouseholds).toHaveBeenCalledTimes(2));
    expect(screen.getByText('warten')).toBeOnTheScreen();

    await act(async () => localRead.resolve([household]));
    expect(await screen.findByText('weiter')).toBeOnTheScreen();
    expect(mockDecision).not.toHaveBeenCalledWith('/household/create');
  });

  it('leitet erst nach einem erfolgreich bestaetigten leeren Haushaltsspiegel um', async () => {
    const pull = deferred<PullOutcome[]>();
    mockPullHousehold.mockReturnValue(pull.promise);
    await start();
    expect(screen.getByText('warten')).toBeOnTheScreen();

    await act(async () => pull.resolve([{ ...successfulPullOutcome, rowsWritten: 0 }]));
    expect(await screen.findByText('/household/create')).toBeOnTheScreen();
  });

  it('interpretiert einen Pull-Fehler nicht als fehlenden Haushalt und erholt sich beim Reconnect', async () => {
    mockPullHousehold.mockResolvedValue([{ ...successfulPullOutcome, error: 'offline' }]);
    await start();
    await waitFor(() => expect(mockReadHouseholds).toHaveBeenCalledTimes(2));
    expect(screen.getByText('fehler')).toBeOnTheScreen();

    mockPullHousehold.mockImplementation(async () => {
      mockReadHouseholds.mockResolvedValue([household]);
      return successfulPull;
    });
    await act(async () => mockReconnect());
    expect(await screen.findByText('weiter')).toBeOnTheScreen();
    expect(mockDecision).not.toHaveBeenCalledWith('/household/create');
  });

  it('wartet auch mit lokalem Haushalt auf den abgeschlossenen Server-Pull', async () => {
    const pull = deferred<PullOutcome[]>();
    mockPullHousehold.mockReturnValue(pull.promise);
    mockReadHouseholds.mockResolvedValue([household]);
    await start();
    expect(screen.getByText('warten')).toBeOnTheScreen();
    await act(async () => pull.resolve(successfulPull));
    expect(await screen.findByText('weiter')).toBeOnTheScreen();
    expect(mockDecision).not.toHaveBeenCalledWith('/household/create');
  });

  it('setzt die laufende App bei einem spaeteren Hintergrund-Pull nicht zurueck', async () => {
    mockPullHousehold.mockResolvedValue(successfulPull);
    mockReadHouseholds.mockResolvedValue([household]);
    await start();
    expect(await screen.findByText('weiter')).toBeOnTheScreen();

    mockPullHousehold.mockResolvedValue([{ ...successfulPullOutcome, error: 'offline' }]);
    await act(async () => mockReconnect());

    expect(screen.getByText('weiter')).toBeOnTheScreen();
  });

  it('zeigt einen Fehlerzustand bei einem fehlgeschlagenen Bootstrap-Pull', async () => {
    mockPullHousehold.mockRejectedValue(new Error('offline'));
    await start();

    expect(await screen.findByText('fehler')).toBeOnTheScreen();
    expect(mockDecision).not.toHaveBeenCalledWith('/household/create');
  });
});
