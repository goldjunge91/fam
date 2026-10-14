import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { Alert } from 'react-native';
import { SyncDebugScreen } from '@/features/settings/sync-debug-screen';
import { loadOutboxHistory } from '@/lib/db/outbox';

const mockTrackAnalyticsEvent = jest.fn((..._args: unknown[]) => undefined);
const mockSendTestNotification = jest.fn(async () => ({ success: true, message: 'sent' }));
const mockDeleteOutboxEntries = jest.fn(async (..._args: unknown[]) => undefined);
const mockTriggerHouseholdSync = jest.fn(async (..._args: unknown[]) => ({ status: 'completed' }));
const mockSyncRunHasErrors = jest.fn((_result?: unknown) => false);
const mockHasAccess = jest.fn(() => true);
const mockResetBarcodeLookup = jest.fn();
const mockLookupBarcode = jest.fn();
const mockActiveHousehold = jest.fn(
  () =>
    ({ id: 'household-1', name: 'Familie' }) as {
      id: string;
      name: string;
    } | null,
);
const mockGetLastSyncInfo = jest.fn(
  () =>
    null as null | {
      timestamp: string;
      pushedCount: number;
      pulledCount: number;
    },
);
const mockGetLastRealtimeStatus = jest.fn(() => null as string | null);
const mockGetActiveSyncEngineIntervalCount = jest.fn(() => 0);
const mockGetRealtimeDiagnostics = jest.fn(() => ({ statusChangeCount: 0, reconnectCount: 0 }));
const mockGetRealtimeLatencySamples = jest.fn(
  () => [] as Array<{ latencyMs: number | null; timestamp: number; op: string; entity: string }>,
);
const mockGetRealtimeLatencySampleVersion = jest.fn(() => 0);
const mockDebugError = jest.fn();

function defaultDatabaseRows(query: string): unknown[] {
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
}

const mockGetAllAsync = jest.fn(
  async (query: string): Promise<unknown[]> => defaultDatabaseRows(query),
);

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

jest.mock('expo-router', () => {
  const { Text: MockText } = jest.requireActual('react-native') as typeof import('react-native');
  return { Redirect: ({ href }: { href: string }) => <MockText>{href}</MockText> };
});

jest.mock('@/constants/ui', () => {
  const {
    Pressable: MockPressable,
    Text: MockText,
    View: MockView,
  } = jest.requireActual('react-native') as typeof import('react-native');
  type MockButtonProps = { title: string; onPress?: () => void };
  type MockTextProps = { children: import('react').ReactNode };

  return {
    Button: ({ title, onPress }: MockButtonProps) => (
      <MockPressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>
        <MockText>{title}</MockText>
      </MockPressable>
    ),
    Txt: ({ children }: MockTextProps) => <MockText>{children}</MockText>,
    Divider: MockView,
    Press: MockPressable,
    Row: MockView,
  };
});

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHousehold: mockActiveHousehold() }),
}));

jest.mock('@/features/inventory/barcode-scanner-modal', () => {
  const {
    Pressable: MockPressable,
    Text: MockText,
    View: MockView,
  } = jest.requireActual('react-native') as typeof import('react-native');
  type MockProps = {
    visible: boolean;
    onClose: () => void;
    onBarcodeDetected: (barcode: string) => void;
  };
  return {
    BarcodeScannerModal: ({ visible, onClose, onBarcodeDetected }: MockProps) =>
      visible ? (
        <MockView>
          <MockText>Scanner sichtbar</MockText>
          <MockPressable onPress={() => onBarcodeDetected('12345')}>
            <MockText>Barcode erkannt</MockText>
          </MockPressable>
          <MockPressable onPress={onClose}>
            <MockText>Scanner schließen</MockText>
          </MockPressable>
        </MockView>
      ) : null,
  };
});

jest.mock('@/features/product-search/hooks/use-product-barcode-lookup', () => ({
  useProductBarcodeLookup: ({
    onFound,
  }: {
    onFound: (product: {
      name: string;
      brand: string | null;
      barcode: string;
      quantity: number;
      unit: string;
    }) => void;
  }) => ({
    lookup: async (barcode: string) => {
      mockLookupBarcode(barcode);
      const product = {
        name: 'Kaffee',
        brand: null,
        barcode,
        quantity: 1,
        unit: 'Packung',
      };
      onFound(product);
      return product;
    },
    reset: () => mockResetBarcodeLookup(),
    looking: false,
    errorMessage: null,
  }),
}));

jest.mock('@/hooks/use-dev-tools-access', () => ({
  useDevToolsAccess: () => mockHasAccess(),
}));

jest.mock('@/hooks/use-sync-status', () => ({
  useSyncStatus: () => ({ kind: 'hidden' }),
}));

jest.mock('@/lib/analytics', () => ({
  trackAnalyticsEvent: (...args: unknown[]) => mockTrackAnalyticsEvent(...args),
}));

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: jest.fn(async () => ({
    getAllAsync: mockGetAllAsync,
    runAsync: jest.fn(),
  })),
}));

jest.mock('@/lib/db/outbox', () => ({
  deleteOutboxEntries: (...args: unknown[]) => mockDeleteOutboxEntries(...args),
  loadOutboxHistory: jest.fn(async () => []),
}));

jest.mock('@/lib/platform/notifications', () => ({
  sendTestNotification: () => mockSendTestNotification(),
}));

jest.mock('@/lib/observability/debug-log', () => ({
  debugError: (...args: unknown[]) => mockDebugError(...args),
}));

jest.mock('@/lib/sync/sync-runner', () => ({
  getActiveSyncEngineIntervalCount: () => mockGetActiveSyncEngineIntervalCount(),
  getLastRealtimeStatus: () => mockGetLastRealtimeStatus(),
  getLastSyncInfo: () => mockGetLastSyncInfo(),
  getRealtimeDiagnostics: () => mockGetRealtimeDiagnostics(),
  getRealtimeLatencySamples: () => mockGetRealtimeLatencySamples(),
  getRealtimeLatencySampleVersion: () => mockGetRealtimeLatencySampleVersion(),
  syncRunHasErrors: (result: unknown) => mockSyncRunHasErrors(result),
  triggerHouseholdSync: (...args: unknown[]) => mockTriggerHouseholdSync(...args),
}));

describe('SyncDebugScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(loadOutboxHistory).mockResolvedValue([]);
    mockGetAllAsync.mockImplementation(
      async (query: string): Promise<unknown[]> => defaultDatabaseRows(query),
    );
    mockHasAccess.mockReturnValue(true);
    mockActiveHousehold.mockReturnValue({ id: 'household-1', name: 'Familie' });
    mockGetLastSyncInfo.mockReturnValue(null);
    mockGetLastRealtimeStatus.mockReturnValue(null);
    mockGetActiveSyncEngineIntervalCount.mockReturnValue(0);
    mockGetRealtimeDiagnostics.mockReturnValue({ statusChangeCount: 0, reconnectCount: 0 });
    mockGetRealtimeLatencySamples.mockReturnValue([]);
    mockGetRealtimeLatencySampleVersion.mockReturnValue(0);
    mockSyncRunHasErrors.mockReturnValue(false);
    mockSendTestNotification.mockResolvedValue({ success: true, message: 'sent' });
    mockTriggerHouseholdSync.mockResolvedValue({ status: 'completed' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  async function renderScreen(waitForInitialData = true) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
    await render(
      <QueryClientProvider client={queryClient}>
        <SyncDebugScreen />
      </QueryClientProvider>,
    );
    if (waitForInitialData) {
      await waitFor(() =>
        expect(mockGetAllAsync).toHaveBeenCalledWith(
          'select id, name, quantity, unit, location_id, household_id from fridge_items limit 20',
        ),
      );
    } else {
      await waitFor(() => expect(mockGetAllAsync).toHaveBeenCalled());
    }
    return queryClient;
  }

  it('zeigt Inventory-Mengen aus Integer-Tausendsteln als physische Menge an', async () => {
    await renderScreen();

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

    await renderScreen();

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

    await renderScreen();

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

    await renderScreen();

    expect(await screen.findByText(/· ID: unbekannt-1$/)).toBeOnTheScreen();
  });

  it('zeigt Namen aus dem Payload gekürzt und markiert fehlgeschlagene Historieneinträge', async () => {
    const longName = 'A'.repeat(70);
    jest.mocked(loadOutboxHistory).mockResolvedValue([
      {
        id: 4,
        outbox_id: 18,
        entity: 'recipes',
        entity_id: 'recipe-1',
        op: 'insert',
        payload: JSON.stringify({ title: ` ${longName} ` }),
        created_at: 1_000,
        status: 'failed',
        attempts: 2,
        last_error: 'offline',
        last_error_kind: 'transient',
        updated_at: 2_000,
        completed_at: null,
      },
    ]);

    await renderScreen();

    expect(await screen.findByText('fehlgeschlagen')).toBeOnTheScreen();
    expect(screen.getByText(/· A{59}…$/)).toBeOnTheScreen();
  });

  it('fällt bei ungültigem Payload-JSON auf die Eintrags-ID zurück', async () => {
    jest.mocked(loadOutboxHistory).mockResolvedValue([
      {
        id: 5,
        outbox_id: 20,
        entity: 'recipes',
        entity_id: 'recipe-20',
        op: 'insert',
        payload: '{broken',
        created_at: 1_000,
        status: 'discarded',
        attempts: 1,
        last_error: null,
        last_error_kind: null,
        updated_at: 2_000,
        completed_at: 2_000,
      },
    ]);

    await renderScreen();

    expect(await screen.findByText('verworfen')).toBeOnTheScreen();
    expect(screen.getByText(/· ID: recipe-20$/)).toBeOnTheScreen();
  });

  it('zeigt Sync-, Realtime- und Latenzdiagnosen einschließlich des Durchschnitts', async () => {
    mockGetLastSyncInfo.mockReturnValue({
      timestamp: '2026-10-11T09:30:00.000Z',
      pushedCount: 4,
      pulledCount: 7,
    });
    mockGetLastRealtimeStatus.mockReturnValue('SUBSCRIBED');
    mockGetActiveSyncEngineIntervalCount.mockReturnValue(2);
    mockGetRealtimeDiagnostics.mockReturnValue({ statusChangeCount: 6, reconnectCount: 1 });
    mockGetRealtimeLatencySamples.mockReturnValue([
      { latencyMs: 2_001, timestamp: 1_000, op: 'insert', entity: 'fridge_items' },
      { latencyMs: null, timestamp: 2_000, op: 'update', entity: 'recipes' },
      { latencyMs: 1_000, timestamp: 3_000, op: 'delete', entity: 'stores' },
    ]);

    await renderScreen();

    expect(await screen.findByText('4 Einträge')).toBeOnTheScreen();
    expect(screen.getByText('7 Zeilen')).toBeOnTheScreen();
    expect(screen.getByText('SUBSCRIBED')).toBeOnTheScreen();
    expect(screen.getByText(/sollte 1 sein/)).toBeOnTheScreen();
    expect(screen.getByText('1')).toBeOnTheScreen();
    expect(screen.getByText('1501 ms')).toBeOnTheScreen();
    expect(screen.getByText(/Realtime-Latenz \(letzte 3 Zeilen\)/)).toBeOnTheScreen();
  });

  it('zeigt einen Platzhalter, wenn Realtime-Samples keine Latenzwerte enthalten', async () => {
    mockGetRealtimeLatencySamples.mockReturnValue([
      { latencyMs: null, timestamp: 1_000, op: 'update', entity: 'recipes' },
    ]);

    await renderScreen();

    expect(await screen.findByText('— ms')).toBeOnTheScreen();
    expect(screen.getByText('Durchschnitt:')).toBeOnTheScreen();
  });

  it('zeigt lokale Lagerorte aus der SQLite-Spiegelung', async () => {
    mockGetAllAsync.mockImplementation(async (query: string): Promise<unknown[]> => {
      if (query.includes('from storage_locations')) {
        return [{ id: 'loc-1', name: 'Küche', kind: 'pantry', household_id: 'household-1' }];
      }
      return defaultDatabaseRows(query);
    });

    await renderScreen();

    expect(screen.getByText('Küche')).toBeOnTheScreen();
    expect(screen.getByText('Typ: pantry | ID: loc-1')).toBeOnTheScreen();
  });

  it('führt den manuellen Sync aus und protokolliert einen fehlgeschlagenen Lauf', async () => {
    const queryClient = await renderScreen();
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();
    mockSyncRunHasErrors.mockReturnValue(true);
    mockTriggerHouseholdSync.mockResolvedValue({ status: 'partial' });

    await user.press(screen.getByRole('button', { name: 'Jetzt synchronisieren & prüfen' }));

    await waitFor(() =>
      expect(mockTriggerHouseholdSync).toHaveBeenCalledWith(['household-1'], true, queryClient),
    );
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith('sync.manual.started', {
      source: 'sync_debug',
    });
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith('sync.manual.failed', {
      source: 'sync_debug',
    });
    expect(invalidateQueries).toHaveBeenCalled();
    await act(async () => {
      await waitFor(() => expect(mockGetAllAsync).toHaveBeenCalledTimes(6));
    });
  });

  it('überspringt den manuellen Sync, wenn kein Haushalt aktiv ist', async () => {
    mockActiveHousehold.mockReturnValue(null);
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByRole('button', { name: 'Jetzt synchronisieren & prüfen' }));

    expect(mockTriggerHouseholdSync).not.toHaveBeenCalled();
    expect(screen.getByText('Kein Haushalt geladen')).toBeOnTheScreen();
  });

  it('zeigt das Ergebnis des Benachrichtigungs-Tests an', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const user = userEvent.setup();
    mockSendTestNotification.mockResolvedValue({ success: false, message: 'Berechtigung fehlt' });
    await renderScreen();

    await user.press(screen.getByRole('button', { name: '🔔 Test-Benachrichtigung senden' }));

    expect(mockSendTestNotification).toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Hinweis', 'Berechtigung fehlt');
  });

  it('öffnet den Barcode-Scanner, zeigt erkannte Produkte und setzt die Suche zurück', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByRole('button', { name: '📷 Barcode-Scanner testen' }));
    expect(screen.getByText('Scanner sichtbar')).toBeOnTheScreen();
    await user.press(screen.getByText('Barcode erkannt'));

    expect(alert).toHaveBeenCalledWith(
      'Produkt erkannt! 📷',
      'Name: Kaffee\nMarke: —\nBarcode: 12345\nMenge: 1 Packung',
    );
    await user.press(screen.getByText('Scanner schließen'));
    expect(screen.queryByText('Scanner sichtbar')).toBeNull();
    expect(mockResetBarcodeLookup).toHaveBeenCalled();
  });

  it('kopiert Outbox-Einträge mit und ohne Fehlermeldung und erlaubt das Löschen', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockGetAllAsync.mockImplementation(async (query: string): Promise<unknown[]> => {
      if (query.includes('select * from outbox')) {
        return [
          {
            id: 4,
            entity: 'fridge_items',
            entity_id: 'item-1',
            op: 'update',
            payload: '{"name":"Milch"}',
            created_at: 1_000,
            attempts: 2,
            last_error: 'offline',
          },
          {
            id: 5,
            entity: 'recipes',
            entity_id: 'recipe-1',
            op: 'insert',
            payload: '{"title":"Suppe"}',
            created_at: 2_000,
            attempts: 0,
            last_error: null,
          },
        ];
      }
      return defaultDatabaseRows(query);
    });
    await renderScreen();

    const [firstPayloadButton, secondPayloadButton] = screen.getAllByRole('button', {
      name: 'Payload kopieren',
    });
    if (!firstPayloadButton || !secondPayloadButton) throw new Error('Outbox-Payloads fehlen.');
    await user.press(screen.getByRole('button', { name: 'Fehler kopieren' }));
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(
      'Outbox #4 UPDATE fridge_items\nID: item-1 | Versuche: 2\nFehler: offline\nPayload: {"name":"Milch"}',
    );
    await user.press(firstPayloadButton);
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(
      'Outbox #4 UPDATE fridge_items\nID: item-1 | Versuche: 2\nFehler: offline\nPayload: {"name":"Milch"}',
    );
    await user.press(secondPayloadButton);
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(
      'Outbox #5 INSERT recipes\nID: recipe-1 | Versuche: 0\nPayload: {"title":"Suppe"}',
    );

    const firstCopyButton = screen.getAllByRole('button', { name: '📋 Kopieren' })[0];
    if (!firstCopyButton) throw new Error('Outbox-Kopieraktion fehlt.');
    await user.press(firstCopyButton);
    expect(screen.getByRole('button', { name: '✓ Kopiert' })).toBeOnTheScreen();
    await act(async () => {
      jest.advanceTimersByTime(2_000);
    });
    expect(screen.getAllByRole('button', { name: '📋 Kopieren' })).toHaveLength(2);

    const deleteEntryButton = screen.getAllByRole('button', { name: 'Eintrag löschen' })[0];
    if (!deleteEntryButton) throw new Error('Outbox-Löschaktion fehlt.');
    await user.press(deleteEntryButton);
    const deleteButtons = alert.mock.calls.at(-1)?.[2];
    const deleteAction = deleteButtons?.find((button) => button.text === 'Löschen');
    if (!deleteAction?.onPress) throw new Error('Löschaktion wurde nicht angezeigt.');
    await deleteAction.onPress();
    await act(async () => {
      await waitFor(() =>
        expect(mockDeleteOutboxEntries).toHaveBeenCalledWith(expect.anything(), [4]),
      );
      await waitFor(() => expect(mockGetAllAsync).toHaveBeenCalledTimes(6));
    });
  });

  it('leert die Outbox nach Bestätigung der Warnung', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const user = userEvent.setup();
    mockGetAllAsync.mockImplementation(async (query: string): Promise<unknown[]> => {
      if (query.includes('select * from outbox')) {
        return [
          {
            id: 9,
            entity: 'fridge_items',
            entity_id: 'item-9',
            op: 'delete',
            payload: '{}',
            created_at: 1_000,
            attempts: 1,
            last_error: 'offline',
          },
        ];
      }
      if (query.includes('select id from outbox')) return [{ id: 9 }, { id: 10 }];
      return defaultDatabaseRows(query);
    });
    await renderScreen();

    await user.press(screen.getByRole('button', { name: 'Outbox leeren (Notfall)' }));
    const clearButtons = alert.mock.calls.at(-1)?.[2];
    const clearAction = clearButtons?.find((button) => button.text === 'Leeren');
    if (!clearAction?.onPress) throw new Error('Bestätigung zum Leeren fehlt.');
    await clearAction.onPress();

    await act(async () => {
      await waitFor(() =>
        expect(mockDeleteOutboxEntries).toHaveBeenCalledWith(expect.anything(), [9, 10]),
      );
      await waitFor(() => expect(mockGetAllAsync).toHaveBeenCalledTimes(7));
    });
  });

  it('fängt Fehler beim Laden lokaler Diagnosedaten ab', async () => {
    mockGetAllAsync.mockRejectedValueOnce(new Error('database unavailable'));

    await renderScreen(false);

    await waitFor(() =>
      expect(mockDebugError).toHaveBeenCalledWith(
        'Fehler beim Laden der Debug-Daten:',
        expect.any(Error),
      ),
    );
  });

  it('leitet Nutzer ohne Entwicklerzugriff zu den Einstellungen zurück', async () => {
    mockHasAccess.mockReturnValue(false);

    await renderScreen(false);

    expect(screen.getByText('/settings')).toBeOnTheScreen();
  });
});
