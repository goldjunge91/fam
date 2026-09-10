import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { InventoryScreen } from '@/features/inventory/inventory-screen';
import type { LocalInventoryItem } from '@/features/inventory/use-inventory-items';
import type { LocalInventoryTransaction } from '@/features/inventory/use-inventory-transactions';
import type { SyncStatusView } from '@/lib/sync/sync-status';

const mockUpdateQtyMutate = jest.fn();
const mockUpdateExpiryMutate = jest.fn();
const mockUpdateItemMutateAsync = jest.fn().mockResolvedValue({});
const mockOpenMutate = jest.fn();
const mockWasteMutate = jest.fn();
const mockUndoMutate = jest.fn();
const mockDiscardConflictMutate = jest.fn();
const mockReconfirmConflictMutate = jest.fn();

let mockItems: LocalInventoryItem[] = [];
let mockTransactions: LocalInventoryTransaction[] = [];
let mockTransactionsLoading = false;
let mockTransactionsError = false;
const mockTransactionsRefetch = jest.fn();
let mockUndoPending = false;
let mockSyncStatus: SyncStatusView = { kind: 'hidden' };
let mockParams: Record<string, string> = {};

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  return {
    __esModule: true,
    default: ({ children, renderRightActions }: Record<string, unknown>) => {
      const actions =
        typeof renderRightActions === 'function'
          ? renderRightActions(
              { value: 0 },
              { value: 0 },
              { close: jest.fn(), openLeft: jest.fn(), openRight: jest.fn(), reset: jest.fn() },
            )
          : null;
      return (
        <>
          {children}
          {actions}
        </>
      );
    },
  };
});

jest.mock('@/components/forms/date-wheel-field', () => {
  const { Pressable, Text } = require('react-native');

  return {
    DateWheelField: ({
      label,
      value,
      onChange,
    }: {
      label?: string;
      value: string;
      onChange: (value: string) => void;
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value ? `${label} ${value} ändern` : `${label} auswählen`}
        onPress={() => onChange('2026-10-31')}>
        <Text>{value}</Text>
      </Pressable>
    ),
  };
});

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useNavigation: () => ({ canGoBack: () => false, addListener: () => () => {} }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
  useOptionalActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
}));

jest.mock('@/features/inventory/use-storage-locations', () => ({
  useStorageLocations: () => ({ data: [] }),
}));

jest.mock('@/features/inventory/use-inventory-items', () => ({
  useInventoryItems: () => ({ data: mockItems, isLoading: false }),
}));

jest.mock('@/features/inventory/use-inventory-transactions', () => ({
  ...jest.requireActual('@/features/inventory/use-inventory-transactions'),
  useInventoryTransactions: () => ({
    data: mockTransactions,
    isLoading: mockTransactionsLoading,
    isError: mockTransactionsError,
    refetch: mockTransactionsRefetch,
  }),
}));

jest.mock('@/features/inventory/use-inventory-mutations', () => ({
  useUpdateInventoryItemQuantityMutation: () => ({ mutate: mockUpdateQtyMutate, isPending: false }),
  useUpdateFridgeItemMutation: () => ({
    mutate: mockUpdateExpiryMutate,
    mutateAsync: mockUpdateItemMutateAsync,
    isPending: false,
  }),
  useOpenInventoryItemMutation: () => ({ mutate: mockOpenMutate, isPending: false }),
  useWasteInventoryItemMutation: () => ({ mutate: mockWasteMutate, isPending: false }),
  useUndoInventoryTransactionMutation: () => ({
    mutate: mockUndoMutate,
    isPending: mockUndoPending,
  }),
  useDiscardInventoryConflictMutation: () => ({
    mutate: mockDiscardConflictMutate,
    isPending: false,
    variables: undefined,
  }),
  useReconfirmInventoryConflictMutation: () => ({
    mutate: mockReconfirmConflictMutate,
    isPending: false,
    variables: undefined,
  }),
}));

jest.mock('@/features/inventory/use-inventory-conflicts', () => ({
  useInventoryConflicts: () => new Map(),
}));

jest.mock('@/features/inventory/use-product', () => ({
  useProduct: () => ({ data: null, isLoading: false }),
}));

jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({ openDrawer: jest.fn(), openProfile: jest.fn() }),
}));

jest.mock('@/features/navigation/use-profile-initials', () => ({
  useProfileAvatar: () => ({ initials: 'MM', avatarUrl: null }),
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => require('@/components/theme/index').Colors.light,
}));

jest.mock('@/hooks/use-sync-status', () => ({
  useSyncStatus: () => mockSyncStatus,
}));

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  const result = await render(
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <InventoryScreen />
      </SafeAreaProvider>
    </QueryClientProvider>,
  );

  // FlashList plant beim Mount ein setTimeout fuers erste Layout (useOnLoad).
  // RNTLs user-event wait()
  // wrapt diesen Schritt selbst NICHT in act() (nur die Event-Dispatches),
  // daher hier explizit VOR der ersten Interaktion abfliessen lassen, statt
  // spaeter unkontrolliert waehrend user.press() zu feuern.
  await act(() => {
    jest.advanceTimersByTime(60);
  });

  return result;
}

async function openLotActions(user: ReturnType<typeof userEvent.setup>) {
  await user.press(screen.getByRole('button', { name: 'Milch, 2 L' }));
  const groupModal = screen.container.queryAll(
    (instance) =>
      instance.props.visible === true && typeof instance.props.onRequestClose === 'function',
  )[0];
  expect(groupModal).toBeDefined();
  await user.press(screen.getByRole('button', { name: 'Milch, 2 L, MHD ohne MHD, Kein Lagerort' }));
  await act(() => groupModal?.props.onDismiss());
}

function makeTransaction(
  overrides: Partial<LocalInventoryTransaction> = {},
): LocalInventoryTransaction {
  return {
    id: 'transaction-1',
    household_id: 'hh-1',
    fridge_item_id: 'item-1',
    product_id: null,
    actor: 'user-1',
    type: 'in',
    quantity: 1,
    location_id: null,
    reason: null,
    previous_expiry_date: null,
    notes: null,
    undone: false,
    created_at: new Date(Date.now() - 60_000).toISOString(),
    item_name: 'Milch',
    item_unit: 'l',
    location_name: null,
    ...overrides,
  };
}

// FlashList plant beim Mount intern ein setTimeout fuers erste Layout,
// das ausserhalb jeder act()-Kontrolle feuert
// ("The current testing environment is not configured to support act(...)")
// und je nach Systemlast mit Interaktionen des Tests kollidiert (siehe
// test/examples/act-and-real-timers-demo/). Fake Timers machen das
// deterministisch statt wall-clock-abhaengig.
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(async () => {
  // testing-library.com/docs/using-fake-timers: vor dem Zurueckschalten auf
  // echte Timer noch ausstehende Tasks innerhalb von act() abarbeiten.
  await act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

beforeEach(() => {
  mockParams = {};
  mockTransactions = [];
  mockTransactionsLoading = false;
  mockTransactionsError = false;
  mockUndoPending = false;
  mockSyncStatus = { kind: 'hidden' };
  mockItems = [
    {
      id: 'item-1',
      household_id: 'hh-1',
      location_id: null,
      product_id: null,
      name: 'Milch',
      quantity: 2,
      unit: 'l',
      package_size: null,
      package_size_unit: null,
      expiry_date: null,
      added_by: null,
      created_at: '',
      location_kind: null,
      location_name: null,
    },
  ];
  mockUpdateQtyMutate.mockClear();
  mockUpdateExpiryMutate.mockClear();
  mockUpdateItemMutateAsync.mockClear();
  mockOpenMutate.mockClear();
  mockWasteMutate.mockClear();
  mockUndoMutate.mockClear();
  mockTransactionsRefetch.mockClear();
});

it('öffnet beim kurzen Tap die MHD-Auswahl und ändert danach die Losmenge', async () => {
  const user = userEvent.setup();

  await renderScreen();
  await openLotActions(user);

  expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeOnTheScreen();
  expect(
    screen.getByRole('button', { name: 'Mindesthaltbarkeitsdatum auswählen' }),
  ).toBeOnTheScreen();

  await user.press(screen.getByRole('button', { name: 'Aktuelle Menge erhöhen' }));
  expect(mockUpdateQtyMutate).toHaveBeenCalledWith({
    id: 'item-1',
    household_id: 'hh-1',
    delta: 1,
  });
});

it('setzt den Schutzstatus beim manuellen MHD-Schnellzugriff', async () => {
  const user = userEvent.setup();

  await renderScreen();
  await openLotActions(user);
  await user.press(screen.getByRole('button', { name: 'Mindesthaltbarkeitsdatum auswählen' }));

  expect(mockUpdateExpiryMutate).toHaveBeenCalledWith(
    expect.objectContaining({
      patch: {
        expiry_date: '2026-10-31',
        expiry_user_set: true,
      },
    }),
  );
});

it('öffnet den Option-C-Flow und protokolliert die gewählte Menge', async () => {
  const user = userEvent.setup();

  await renderScreen();
  await openLotActions(user);
  await user.press(screen.getByRole('button', { name: 'Öffnen' }));

  expect(screen.getByText('Milch öffnen')).toBeOnTheScreen();
  expect(screen.getByText('Geöffnete Menge')).toBeOnTheScreen();
  expect(screen.getByText('Versiegelt bleibt')).toBeOnTheScreen();
  expect(screen.getByText('Neu: geöffnet')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: '1 L öffnen' }));

  expect(mockOpenMutate).toHaveBeenCalledWith(
    expect.objectContaining({ item: expect.objectContaining({ id: 'item-1' }), quantity: 1 }),
    expect.any(Object),
  );
});

it('bucht Verschwendung mit dem ausgewählten Grund', async () => {
  const user = userEvent.setup();

  await renderScreen();
  await openLotActions(user);
  await user.press(screen.getByRole('button', { name: 'Wegwerfen' }));
  await user.press(screen.getByRole('radio', { name: 'Schlecht geworden' }));
  await user.press(screen.getByRole('button', { name: 'Als Verschwendung buchen' }));

  expect(mockWasteMutate).toHaveBeenCalledWith(
    expect.objectContaining({ item: expect.objectContaining({ id: 'item-1' }), reason: 'spoiled' }),
    expect.any(Object),
  );
});

it('fragt vor dem Entfernen aus dem Aktions-Sheet nach Bestaetigung', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const user = userEvent.setup();

  await renderScreen();
  await user.press(screen.getByRole('button', { name: 'Milch, 2 L' }));
  await user.press(screen.getByRole('button', { name: 'Milch, 2 L, MHD ohne MHD, Kein Lagerort' }));
  await user.press(screen.getByRole('button', { name: 'Milch entfernen' }));

  expect(alertSpy).toHaveBeenCalledWith(
    'Artikel löschen',
    '"Milch" aus dem Vorrat entfernen?',
    expect.arrayContaining([
      expect.objectContaining({ text: 'Abbrechen', style: 'cancel' }),
      expect.objectContaining({ text: 'Löschen', style: 'destructive' }),
    ]),
  );
  expect(mockUpdateQtyMutate).not.toHaveBeenCalled();

  const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
  buttons.find((b) => b.text === 'Löschen')?.onPress?.();

  expect(mockUpdateQtyMutate).toHaveBeenCalledWith({
    id: 'item-1',
    household_id: 'hh-1',
    delta: -2,
  });

  alertSpy.mockRestore();
});

it('fragt auch über die Linkswisch-Aktion vor dem Entfernen nach', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const user = userEvent.setup();

  await renderScreen();
  await user.press(screen.getByRole('button', { name: 'Milch entfernen' }));

  expect(alertSpy).toHaveBeenCalledWith(
    'Artikel löschen',
    '"Milch" aus dem Vorrat entfernen?',
    expect.any(Array),
  );
  alertSpy.mockRestore();
});

it('öffnet Produktinformationen weiterhin per Long Press', async () => {
  const user = userEvent.setup();

  await renderScreen();
  const row = screen.getByRole('button', { name: 'Milch, 2 L' });

  await user.longPress(row);
  expect(screen.getByText('Produktdaten von Open Food Facts')).toBeOnTheScreen();
});

it('bearbeitet einen Vorratsartikel im eigenen Bottom Sheet', async () => {
  const user = userEvent.setup();

  await renderScreen();
  await user.press(screen.getByRole('button', { name: 'Milch, 2 L' }));
  const groupModal = screen.container.queryAll(
    (instance) =>
      instance.props.visible === true && typeof instance.props.onRequestClose === 'function',
  )[0];
  expect(groupModal).toBeDefined();
  expect(groupModal?.props.onDismiss).toEqual(expect.any(Function));
  await user.press(screen.getByRole('button', { name: 'Milch, 2 L, MHD ohne MHD, Kein Lagerort' }));
  expect(screen.queryByRole('button', { name: 'Bearbeiten' })).not.toBeOnTheScreen();
  await act(() => groupModal?.props.onDismiss());
  expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeOnTheScreen();
  const actionSheetModal = screen.container.queryAll(
    (instance) =>
      typeof instance.props.onRequestClose === 'function' &&
      typeof instance.props.onDismiss === 'function',
  )[0];
  expect(actionSheetModal).toBeDefined();
  await user.press(screen.getByRole('button', { name: 'Bearbeiten' }));

  expect(screen.queryByText('Artikel bearbeiten')).not.toBeOnTheScreen();
  await act(() => actionSheetModal?.props.onDismiss());
  expect(screen.getByText('Artikel bearbeiten')).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('Artikelname'), 'Haferdrink');
  await user.press(screen.getByRole('button', { name: 'Menge erhöhen' }));
  await user.press(screen.getByRole('button', { name: 'Änderungen speichern' }));

  expect(mockUpdateItemMutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'item-1',
      household_id: 'hh-1',
      patch: { name: 'Haferdrink' },
      quantityCorrection: { expectedQuantity: 2, newQuantity: 3 },
    }),
  );
});

it('bietet im Vorrat keine Lagerort-Verwaltung an', async () => {
  await renderScreen();
  expect(screen.queryByRole('button', { name: 'Lagerorte verwalten' })).not.toBeOnTheScreen();
});

it('zeigt die Ablauf-Ringe über der kompakten Arbeitsliste', async () => {
  await renderScreen();

  expect(
    screen.getByLabelText('0 Artikel laufen bald ab, 0 bald fällig, 1 insgesamt im Vorrat'),
  ).toBeTruthy();
  expect(screen.getByText('Läuft bald ab')).toBeTruthy();
  expect(screen.getByText('Bald fällig')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Milch, 2 L' })).toBeTruthy();
});

it('addiert gleiche Artikel in der Zeile und zeigt jedes MHD im Detail-Sheet', async () => {
  const user = userEvent.setup();
  mockItems = [
    {
      ...mockItems[0],
      id: 'item-1',
      quantity: 2,
      expiry_date: '2026-09-03',
    },
    {
      ...mockItems[0],
      id: 'item-2',
      name: ' milch ',
      quantity: 1,
      expiry_date: '2026-09-12',
    },
  ];

  await renderScreen();
  expect(screen.getByRole('button', { name: 'Milch, 3 L, 2 MHD-Einträge' })).toBeOnTheScreen();
  expect(screen.queryByText(' milch ')).not.toBeOnTheScreen();

  await user.press(screen.getByRole('button', { name: 'Milch, 3 L, 2 MHD-Einträge' }));
  expect(
    screen.getByRole('button', {
      name: 'Milch, 1 L, MHD 12.09.2026, Kein Lagerort',
    }),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole('button', {
      name: 'Milch, 2 L, MHD 03.09.2026, Kein Lagerort',
    }),
  ).toBeOnTheScreen();
});

it('öffnet den Produktverlauf als Vollansicht ohne Gesamtverlaufs-Link', async () => {
  const user = userEvent.setup();

  await renderScreen();
  await user.press(screen.getByRole('button', { name: 'Milch, 2 L' }));
  await user.press(screen.getByRole('button', { name: 'Milch Verlauf öffnen' }));

  expect(screen.getByText('Verlauf zu Milch')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Gesamten Verlauf öffnen' })).not.toBeOnTheScreen();
});

it('zeigt für alle erlaubten Transaktionstypen genau eine Undo-Aktion', async () => {
  const user = userEvent.setup();
  const moveIn = makeTransaction({
    id: 'move-in',
    operation_id: 'move-1',
    operation_legs: 2,
    type: 'in',
  });
  mockTransactions = [
    makeTransaction({ id: 'in', type: 'in' }),
    makeTransaction({ id: 'out', type: 'out' }),
    makeTransaction({ id: 'waste', type: 'waste', reason: 'spoiled' }),
    makeTransaction({ id: 'move-out', operation_id: 'move-1', operation_legs: 2, type: 'out' }),
    moveIn,
  ];

  await renderScreen();
  await user.press(screen.getByRole('button', { name: 'Gesamten Vorratsverlauf öffnen' }));

  expect(screen.getByRole('button', { name: 'Einkauf rückgängig machen' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Verbrauch rückgängig machen' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Verschwendung rückgängig machen' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Verschiebung rückgängig machen' })).toBeOnTheScreen();
  expect(screen.getAllByRole('button', { name: /rückgängig machen/ })).toHaveLength(4);

  await user.press(screen.getByRole('button', { name: 'Verschiebung rückgängig machen' }));
  expect(mockUndoMutate).toHaveBeenCalledWith({ transaction: moveIn }, expect.any(Object));
});

it('blendet eine bereits reversierte Buchung aus dem Undo-Verlauf aus', async () => {
  const user = userEvent.setup();
  mockTransactions = [makeTransaction({ has_reversal: true })];

  await renderScreen();
  await user.press(screen.getByRole('button', { name: 'Gesamten Vorratsverlauf öffnen' }));

  expect(screen.queryByRole('button', { name: /rückgängig machen/ })).not.toBeOnTheScreen();
});

it('deaktiviert alle Undo-Aktionen während eine Gegenbuchung läuft', async () => {
  const user = userEvent.setup();
  mockTransactions = [makeTransaction({ type: 'out' })];
  mockUndoPending = true;

  await renderScreen();
  await user.press(screen.getByRole('button', { name: 'Gesamten Vorratsverlauf öffnen' }));

  const undoButton = screen.getByRole('button', { name: 'Verbrauch rückgängig machen' });
  expect(undoButton.props.accessibilityState).toEqual({ disabled: true });
  await user.press(undoButton);
  expect(mockUndoMutate).not.toHaveBeenCalled();
});

it('zeigt den Ladezustand des Verlaufs', async () => {
  const user = userEvent.setup();
  mockTransactionsLoading = true;

  await renderScreen();
  await user.press(screen.getByRole('button', { name: 'Gesamten Vorratsverlauf öffnen' }));

  expect(screen.getByText('Verlauf wird geladen…')).toBeOnTheScreen();
});

it('zeigt den Fehlerzustand und kann den Verlauf erneut laden', async () => {
  const user = userEvent.setup();
  mockTransactionsError = true;

  await renderScreen();
  await user.press(screen.getByRole('button', { name: 'Gesamten Vorratsverlauf öffnen' }));
  expect(screen.getByText('Verlauf konnte nicht geladen werden.')).toBeOnTheScreen();

  await user.press(screen.getByRole('button', { name: 'Erneut versuchen' }));
  expect(mockTransactionsRefetch).toHaveBeenCalledTimes(1);
});

it('kennzeichnet den Verlauf bei Offline-Betrieb als lokale Daten', async () => {
  const user = userEvent.setup();
  mockSyncStatus = { kind: 'offline', pendingCount: 2 };

  await renderScreen();
  await user.press(screen.getByRole('button', { name: 'Gesamten Vorratsverlauf öffnen' }));

  expect(screen.getByText('Offline: lokale Daten werden angezeigt.')).toBeOnTheScreen();
});

describe('Sortier-Toggle MHD/Name (#71)', () => {
  beforeEach(() => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 2);
    mockItems = [
      {
        id: 'item-apfel',
        household_id: 'hh-1',
        location_id: null,
        product_id: null,
        name: 'Apfel',
        quantity: 1,
        unit: 'piece',
        package_size: null,
        package_size_unit: null,
        expiry_date: null, // bucket 'none' -> steht bei MHD-Sortierung hinten
        added_by: null,
        created_at: '',
        location_kind: null,
        location_name: null,
      },
      {
        id: 'item-zwiebel',
        household_id: 'hh-1',
        location_id: null,
        product_id: null,
        name: 'Zwiebel',
        quantity: 1,
        unit: 'piece',
        package_size: null,
        package_size_unit: null,
        expiry_date: soon.toISOString().split('T')[0], // bucket 'soon' -> steht bei MHD-Sortierung vorn
        added_by: null,
        created_at: '',
        location_kind: null,
        location_name: null,
      },
    ];
  });

  function itemOrder() {
    return screen.getAllByLabelText(/Stück$/).map((el) => el.props.accessibilityLabel as string);
  }

  it('sortiert standardmaessig nach MHD (bald ablaufend zuerst)', async () => {
    await renderScreen();
    expect(itemOrder()).toEqual(['Zwiebel, 1 Stück', 'Apfel, 1 Stück']);
  });

  // Die umsortierte Reihenfolge selbst prueft visible-items.test.ts: FlashList
  // recycelt Zeilen-Views, dadurch bleibt die Reihenfolge im Testbaum nach einem
  // Re-Sort auf dem Mount-Stand stehen (visuell wird ueber Layout positioniert).
  // Am Screen bleibt pruefbar, dass der Toggle den Sortiermodus umschaltet.
  it('schaltet den Sortiermodus per Toggle auf alphabetisch um', async () => {
    const user = userEvent.setup();
    await renderScreen();
    await user.press(
      screen.getByRole('button', {
        name: 'Sortierung ändern, aktuell nach Haltbarkeit',
      }),
    );
    expect(
      screen.getByRole('button', { name: 'Sortierung ändern, aktuell alphabetisch' }),
    ).toBeOnTheScreen();
  });
});

describe('filter=expiring vom Dashboard-Widget (#73)', () => {
  beforeEach(() => {
    mockParams = { filter: 'expiring' };
    const soon = new Date();
    soon.setDate(soon.getDate() + 1);
    const farAway = new Date();
    farAway.setDate(farAway.getDate() + 30);
    mockItems = [
      {
        id: 'item-critical',
        household_id: 'hh-1',
        location_id: 'loc-1',
        product_id: null,
        name: 'Bald abgelaufen',
        quantity: 1,
        unit: 'piece',
        package_size: null,
        package_size_unit: null,
        expiry_date: soon.toISOString().split('T')[0],
        added_by: null,
        created_at: '',
        location_kind: null,
        location_name: null,
      },
      {
        id: 'item-ok',
        household_id: 'hh-1',
        location_id: 'loc-2',
        product_id: null,
        name: 'Noch lange haltbar',
        quantity: 1,
        unit: 'piece',
        package_size: null,
        package_size_unit: null,
        expiry_date: farAway.toISOString().split('T')[0],
        added_by: null,
        created_at: '',
        location_kind: null,
        location_name: null,
      },
    ];
  });

  it('zeigt nur bald ablaufende/abgelaufene Artikel, unabhaengig vom Lagerort-Tab', async () => {
    await renderScreen();
    expect(screen.getByText('Bald abgelaufen')).toBeTruthy();
    expect(screen.queryByText('Noch lange haltbar')).not.toBeOnTheScreen();
  });
});
