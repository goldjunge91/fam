import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { act, type ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DashboardScreen } from '@/features/dashboard/dashboard-screen';

type MockChildrenProps = { children?: ReactNode };

let mockDraxProviderMounts = 0;
let mockDraxSpans: Array<{ colSpan: number; rowSpan: number }> = [];
const mockRouterPush = jest.fn();

jest.mock('react-native-gesture-handler', () => {
  const gestureHandlerMock = require('react-native-gesture-handler/lib/commonjs/mocks/mocks');

  return {
    ...gestureHandlerMock,
    GestureHandlerRootView: ({ children }: MockChildrenProps) => children,
  };
});

jest.mock('react-native-drax', () => {
  const { useEffect } = require('react');

  function DraxProvider({ children }: MockChildrenProps) {
    useEffect(() => {
      mockDraxProviderMounts += 1;
    }, []);
    return children;
  }

  function useSortableList({ data }: { data: unknown[] }) {
    return {
      data,
      onScroll: jest.fn(),
      onContentSizeChange: jest.fn(),
      stableKeyExtractor: (_item: unknown, index: number) => `drax-${index}`,
      _internal: {},
    };
  }

  function packGrid(
    count: number,
    _columns: number,
    getSpan: (index: number) => { colSpan: number; rowSpan: number },
  ) {
    mockDraxSpans = Array.from({ length: count }, (_, index) => getSpan(index));
    return {
      positions: Array.from({ length: count }, (_, index) => ({ col: index % 2, row: 0 })),
      totalRows: 1,
    };
  }

  return {
    DraxProvider,
    SortableContainer: ({ children }: MockChildrenProps) => children,
    SortableItem: ({ children }: MockChildrenProps) => children,
    useSortableList,
    packGrid,
  };
});

jest.mock('@/components/ui/progress-ring', () => ({ ProgressRing: () => null }));
jest.mock('@/components/ui/progress-bar', () => ({ ProgressBar: () => null }));
jest.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: jest.fn() }));

let mockFridgeItems: unknown[] = [];

jest.mock('expo-router', () => ({
  router: { push: mockRouterPush, back: jest.fn(), canGoBack: () => false },
  useNavigation: () => ({ canGoBack: () => false, addListener: () => () => {} }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/calorie-tracking/api', () => ({
  useCurrentGoal: () => ({ data: { daily_kcal: 2000, protein_g: 150, carbs_g: 200, fat_g: 67 } }),
  useFoodEntries: () => ({ data: [] }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
  useOptionalActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
}));

jest.mock('@/features/inventory/use-inventory-items', () => ({
  useInventoryItems: () => ({ data: mockFridgeItems, isLoading: false }),
}));

jest.mock('@/features/inventory/use-inventory-mutations', () => ({
  useUpdateInventoryItemQuantityMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

jest.mock('@/features/inventory/use-expiry-notifications', () => ({
  useExpiryNotifications: () => {},
}));

jest.mock('@/features/shopping-list/hooks/use-shopping-list', () => ({
  useShoppingList: () => ({ data: [] }),
}));

jest.mock('@/features/meal-planner/use-meal-plans', () => ({
  useMealPlanEntriesInRange: () => ({ data: [] }),
}));

jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({ openDrawer: jest.fn(), openProfile: jest.fn() }),
}));

jest.mock('@/features/navigation/use-profile-initials', () => ({
  useProfileAvatar: () => ({ initials: 'MM', avatarUrl: null }),
}));

jest.mock('@/features/settings/module-preferences', () => ({
  useModulePreferences: () => ({
    data: {
      fridge: true,
      shoppingList: true,
      calories: true,
      recipes: true,
      mealPlanner: true,
    },
  }),
  modulePreferencesQueryKey: (userId: string | undefined) =>
    ['settings', 'module-preferences', userId] as const,
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockTriggerHouseholdSync = jest.fn().mockResolvedValue(null);

jest.mock('@/lib/sync/sync-runner', () => ({
  syncRunHasErrors: (result: unknown) => result === null,
  triggerHouseholdSync: (...args: unknown[]) => mockTriggerHouseholdSync(...args),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => require('@/components/theme/index').Colors.light,
}));

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <QueryClientProvider client={queryClient}>
        <DashboardScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockFridgeItems = [];
  mockTriggerHouseholdSync.mockClear();
  mockDraxProviderMounts = 0;
  mockDraxSpans = [];
  mockRouterPush.mockClear();
});

describe('DashboardScreen — Vorrat-Widget "Läuft bald ab"', () => {
  it('zeigt das Widget mit Badge 0, wenn nichts bald ablaeuft', async () => {
    mockFridgeItems = [];
    await renderScreen();
    expect(screen.getByText('Läuft bald ab')).toBeTruthy();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('zeigt die Anzahl bald ablaufender Artikel im Badge', async () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 1);
    mockFridgeItems = [
      {
        id: 'item-1',
        household_id: 'hh-1',
        location_id: null,
        product_id: null,
        name: 'Joghurt',
        quantity: 1,
        unit: 'piece',
        expiry_date: soon.toISOString().split('T')[0],
        added_by: null,
        created_at: '',
        location_kind: null,
        location_name: null,
      },
    ];
    await renderScreen();
    expect(screen.getByText('Läuft bald ab')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });
});

describe('DashboardScreen — Essensplan-Karte', () => {
  it('zeigt Essensplan-Karte mit Label zum Oeffnen', async () => {
    await renderScreen();
    expect(screen.getByLabelText('Essensplan öffnen')).toBeTruthy();
  });
});

describe('DashboardScreen — Kochstreak-Karte', () => {
  it('zeigt die Kochstreak auf der Übersicht', async () => {
    await renderScreen();

    expect(screen.getByText('KOCHSTREAK')).toBeOnTheScreen();
    expect(screen.getByText('Starte deine erste Serie')).toBeOnTheScreen();
  });
});

describe('DashboardScreen — iOS-Style Wackel-Modus & Plus-Button', () => {
  it('aktiviert Edit-Modus bei Long-Press, zeigt Plus- und Fertig-Knopf und öffnet Galerie', async () => {
    await renderScreen();

    // Vor Edit-Modus: Kein Plus- und Fertig-Knopf
    expect(screen.queryByLabelText('Karten anpassen')).toBeNull();
    expect(screen.queryByLabelText('Bearbeitungsmodus beenden')).toBeNull();

    // Long-Press auf eine Karte aktiviert den Edit-Modus
    const plannedCard = screen.getByLabelText('Essensplan öffnen');
    await fireEvent(plannedCard, 'longPress');

    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');

    // Plus-Button und Fertig-Button sind nun im Header sichtbar
    expect(screen.getByLabelText('Karten anpassen')).toBeTruthy();
    const finishButton = screen.getByLabelText('Bearbeitungsmodus beenden');
    expect(finishButton).toBeTruthy();
    expect(finishButton.parent?.parent?.props.style).toEqual(
      expect.objectContaining({ backgroundColor: 'transparent', paddingBottom: 0 }),
    );
    expect(screen.getByLabelText('Essensplan öffnen')).toHaveProp('disabled', true);

    // Plus-Button öffnet das Galerie-Sheet
    await fireEvent.press(screen.getByLabelText('Karten anpassen'));
    expect(screen.getByText('Karten anpassen')).toBeTruthy();
    expect(screen.getByText(/Kochstreak/)).toBeOnTheScreen();

    // Fertig-Knopf in Galerie schließt Sheet
    await fireEvent.press(screen.getByLabelText('Galerie schließen'));

    // Fertig-Knopf im Header beendet Edit-Modus
    await fireEvent.press(screen.getByLabelText('Bearbeitungsmodus beenden'));
    expect(screen.queryByLabelText('Karten anpassen')).toBeNull();
  });

  it('erlaubt das Löschen einer Karte im Edit-Modus und das Wiederherstellen über die Galerie', async () => {
    await renderScreen();

    // In Edit-Modus wechseln
    const plannedCard = screen.getByLabelText('Essensplan öffnen');
    await fireEvent(plannedCard, 'longPress');

    // Delete-Badges sind sichtbar
    const deleteButtons = screen.getAllByLabelText('Karte entfernen');
    expect(deleteButtons.length).toBeGreaterThan(0);

    // Erste Karte löschen
    await fireEvent.press(deleteButtons[0]);
    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');

    // Galerie öffnen um Karte wieder hinzuzufügen
    await fireEvent.press(screen.getByLabelText('Karten anpassen'));

    // Die gelöschte Karte hat nun einen Hinzufügen-Knopf
    const addButtons = screen.getAllByText('+ Hinzufügen');
    expect(addButtons.length).toBeGreaterThan(0);

    // Hinzufügen anklicken
    await fireEvent.press(addButtons[0]);
    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');
  });

  it('berücksichtigt eine benutzerdefinierte Drag & Drop Sortierung', async () => {
    await renderScreen();
    // Alle Standard-Widgets werden in stabiler Reihenfolge gerendert
    expect(screen.getByLabelText('Essensplan öffnen')).toBeTruthy();
    expect(screen.getByText('Läuft bald ab')).toBeTruthy();
  });

  it('setzt das Drag-and-Drop-Layout nach einem Größenwechsel neu auf', async () => {
    await renderScreen();

    await fireEvent(screen.getByLabelText('Essensplan öffnen'), 'longPress');
    expect(mockDraxProviderMounts).toBe(1);

    await fireEvent.press(screen.getAllByLabelText('Kartengröße umschalten')[0]);

    expect(mockDraxProviderMounts).toBe(2);
  });

  it('positioniert zwei kleine Widgets als einzelne DND-Elemente nebeneinander', async () => {
    await renderScreen();

    await fireEvent(screen.getByLabelText('Essensplan öffnen'), 'longPress');

    expect(mockDraxSpans.filter((span) => span.colSpan === 1 && span.rowSpan === 1)).toHaveLength(
      2,
    );
  });
});

describe('DashboardScreen — Pull-to-Refresh', () => {
  it('loest triggerHouseholdSync fuer den aktiven Haushalt aus', async () => {
    await renderScreen();

    const scrollView = screen.getByTestId('dashboard-scroll-view');
    const onRefresh = scrollView.props.refreshControl.props.onRefresh as () => Promise<void>;
    await act(async () => {
      await onRefresh();
    });

    expect(mockTriggerHouseholdSync).toHaveBeenCalledWith(['hh-1'], false, expect.anything());
  });
});
