import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import { SyncDebugScreen } from '@/features/settings/sync-debug-screen';

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

jest.mock('@/components/ui/card', () => {
  const { Text: MockText, View: MockView } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');
  type MockProps = { children: import('react').ReactNode; title?: string };

  return {
    Card: ({ children, title }: MockProps) => (
      <MockView>
        {title ? <MockText>{title}</MockText> : null}
        {children}
      </MockView>
    ),
  };
});

jest.mock('@/constants/ui', () => {
  const { Text: MockText } = jest.requireActual('react-native') as typeof import('react-native');
  type MockButtonProps = { title: string };
  type MockTextProps = { children: import('react').ReactNode };

  return {
    Button: ({ title }: MockButtonProps) => <MockText>{title}</MockText>,
    Txt: ({ children }: MockTextProps) => <MockText>{children}</MockText>,
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

jest.mock('@/hooks/use-sync-status', () => ({
  useSyncStatus: () => ({ kind: 'hidden' }),
}));

jest.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: jest.fn() }));

jest.mock('@/lib/db/client', () => ({
  getDatabase: jest.fn(async () => ({
    getAllAsync: mockGetAllAsync,
    runAsync: jest.fn(),
  })),
}));

jest.mock('@/lib/db/outbox', () => ({
  deleteOutboxEntries: jest.fn(),
}));

jest.mock('@/lib/notifications', () => ({
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
});
