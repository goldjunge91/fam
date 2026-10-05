import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import { SyncDebugScreen } from '@/features/settings/sync-debug-screen';
import { loadOutboxHistory } from '@/lib/db/outbox';

const mockGetAllAsync = jest.fn(async (query: string): Promise<unknown[]> => {
  if (query.includes('from fridge_items')) {
    return [
      {
        id: 'item-1',
        name: 'Milch',
        quantity: 1_500,
        unit: 'ml',
        location_id: null,
        household_id: 'household-1',
      },
    ];
  }

  return [];
});

jest.mock('@/components/layout/screen', () => {
  const { Text: MockText, View: MockView } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');
  type MockProps = { children: import('react').ReactNode; title?: string };

  return {
    Screen: ({ children, title }: MockProps) => (
      <MockView>
        {title ? <MockText>{title}</MockText> : null}
        {children}
      </MockView>
    ),
  };
});

jest.mock('@/components/ui/content-card', () => {
  const { Text: MockText, View: MockView } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');
  type MockProps = { children: import('react').ReactNode; title?: string };

  return {
    ContentCard: ({ children, title }: MockProps) => (
      <MockView>
        {title ? <MockText>{title}</MockText> : null}
        {children}
      </MockView>
    ),
  };
});

jest.mock('@/constants/ui', () => {
  const { Text: MockText, View: MockView } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');
  type MockButtonProps = { title: string };
  type MockTextProps = { children: import('react').ReactNode };

  return {
    Button: ({ title }: MockButtonProps) => <MockText>{title}</MockText>,
    Txt: ({ children }: MockTextProps) => <MockText>{children}</MockText>,
    Divider: MockView,
    Press: MockView,
    Row: MockView,
  };
});

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHousehold: { id: 'household-1', name: 'Familie' } }),
}));

jest.mock('@/features/inventory/barcode-scanner-modal', () => ({
  BarcodeScannerModal: () => null,
}));

jest.mock('@/features/product-search/hooks/use-product-barcode-lookup', () => ({
  useProductBarcodeLookup: () => ({
    lookup: jest.fn(),
    reset: jest.fn(),
    looking: false,
    errorMessage: null,
  }),
}));

jest.mock('@/hooks/use-dev-tools-access', () => ({
  useDevToolsAccess: () => true,
}));

jest.mock('@/hooks/use-sync-status', () => ({
  useSyncStatus: () => ({ kind: 'hidden' }),
}));

jest.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: jest.fn() }));

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: jest.fn(async () => ({
    getAllAsync: mockGetAllAsync,
    runAsync: jest.fn(),
  })),
}));

jest.mock('@/lib/db/outbox', () => ({
  deleteOutboxEntries: jest.fn(),
  loadOutboxHistory: jest.fn(async () => []),
}));

jest.mock('@/lib/platform/notifications', () => ({
  sendTestNotification: jest.fn(),
}));

jest.mock('@/lib/sync/sync-runner', () => ({
  getActiveSyncEngineIntervalCount: () => 0,
  getLastRealtimeStatus: () => null,
  getLastSyncInfo: () => null,
  getRealtimeDiagnostics: () => ({ statusChangeCount: 0, reconnectCount: 0 }),
  getRealtimeLatencySamples: () => [],
  getRealtimeLatencySampleVersion: () => 0,
  syncRunHasErrors: () => false,
  triggerHouseholdSync: jest.fn(),
}));

describe('SyncDebugScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('zeigt Inventory-Mengen aus Integer-Tausendsteln als physische Menge an', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });

    await render(
      <QueryClientProvider client={queryClient}>
        <SyncDebugScreen />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Milch (1.5 ml)')).toBeOnTheScreen();
  });

  it('zeigt abgeschlossene Outbox-Mutationen in der lokalen Historie', async () => {
    jest.mocked(loadOutboxHistory).mockResolvedValue([
      {
        id: 1,
        outbox_id: 7,
        entity: 'storage_locations',
        entity_id: 'location-1',
        op: 'insert',
        payload: '{}',
        created_at: 1_000,
        status: 'pushed',
        attempts: 0,
        last_error: null,
        last_error_kind: null,
        updated_at: 2_000,
        completed_at: 2_000,
      },
    ]);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });

    await render(
      <QueryClientProvider client={queryClient}>
        <SyncDebugScreen />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('synchronisiert')).toBeOnTheScreen();
    expect(screen.getByText('#7 INSERT storage_locations')).toBeOnTheScreen();
    expect(loadOutboxHistory).toHaveBeenCalledWith(expect.anything(), 20);
  });

  it('zeigt in der Outbox-Historie den Artikelnamen statt der UUID', async () => {
    jest.mocked(loadOutboxHistory).mockResolvedValue([
      {
        id: 2,
        outbox_id: 9,
        entity: 'fridge_items',
        entity_id: 'item-1',
        op: 'update',
        payload: '{}',
        created_at: 1_000,
        status: 'queued',
        attempts: 1,
        last_error: null,
        last_error_kind: null,
        updated_at: 2_000,
        completed_at: null,
      },
    ]);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });

    await render(
      <QueryClientProvider client={queryClient}>
        <SyncDebugScreen />
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/· Milch$/)).toBeOnTheScreen();
    expect(screen.queryByText(/· ID: item-1$/)).not.toBeOnTheScreen();
  });

  it('faellt auf die UUID zurueck, wenn lokal kein Name auffindbar ist', async () => {
    jest.mocked(loadOutboxHistory).mockResolvedValue([
      {
        id: 3,
        outbox_id: 11,
        entity: 'fridge_items',
        entity_id: 'unbekannt-1',
        op: 'delete',
        payload: '{}',
        created_at: 1_000,
        status: 'pushed',
        attempts: 0,
        last_error: null,
        last_error_kind: null,
        updated_at: 2_000,
        completed_at: 2_000,
      },
    ]);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });

    await render(
      <QueryClientProvider client={queryClient}>
        <SyncDebugScreen />
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/· ID: unbekannt-1$/)).toBeOnTheScreen();
  });
});
