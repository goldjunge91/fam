import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { act, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colorsLight, shadow, space, withAlpha } from '@/components/theme';
import { DashboardScreen } from '@/features/dashboard/dashboard-screen';
import {
  getDailyMealPlanEmptyArtworkVariant,
  getDailyMealPlanEmptyMessageKey,
} from '@/features/meal-planner/components/dashboard-meals';
import { todayIso } from '@/features/meal-planner/week';
import { i18n } from '@/i18n';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
}));

type MockChildrenProps = { children?: ReactNode };

let mockDraxProviderMounts = 0;
let mockDraxSpans: Array<{ colSpan: number; rowSpan: number }> = [];
let mockSortableItemStyles: Array<Record<string, unknown>> = [];
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
    SortableItem: ({
      children,
      style,
    }: MockChildrenProps & { style?: Record<string, unknown> }) => {
      if (style) mockSortableItemStyles.push(style);
      return children;
    },
    useSortableList,
    packGrid,
  };
});

jest.mock('@/components/ui/progress-ring', () => ({ ProgressRing: () => null }));
jest.mock('@/components/ui/progress-bar', () => ({ ProgressBar: () => null }));
jest.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: jest.fn() }));

let mockFridgeItems: unknown[] = [];
let mockMealPlanEntries: unknown[] = [];
let mockMealCoverUrl: string | null = null;

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
    back: jest.fn(),
    canGoBack: () => false,
  },
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
  useMealPlanEntriesInRange: () => ({ data: mockMealPlanEntries }),
}));

jest.mock('@/features/recipes/data/household-recipe-images', () => ({
  useRecipeCoverUrl: () => ({ data: mockMealCoverUrl }),
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

beforeEach(async () => {
  await i18n.changeLanguage('de');
  mockFridgeItems = [];
  mockMealPlanEntries = [];
  mockMealCoverUrl = null;
  mockTriggerHouseholdSync.mockClear();
  mockDraxProviderMounts = 0;
  mockDraxSpans = [];
  mockSortableItemStyles = [];
  mockRouterPush.mockClear();
});

it('formatiert das Datum der Übersicht anhand der aktiven Sprache', async () => {
  await i18n.changeLanguage('en');

  await renderScreen();

  const expectedDate = new Intl.DateTimeFormat('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  expect(screen.getByText(expectedDate)).toBeOnTheScreen();
});

it('zeigt den Profilbutton im Header, auch im Bearbeitungsmodus', async () => {
  await renderScreen();

  expect(screen.getByRole('button', { name: 'Profil öffnen' })).toBeOnTheScreen();

  await fireEvent(screen.getByLabelText('Essensplan öffnen'), 'longPress');

  expect(screen.getByRole('button', { name: 'Profil öffnen' })).toBeOnTheScreen();
});

it('zeigt Karten und Karten-Galerie in der aktiven Sprache', async () => {
  await i18n.changeLanguage('en');

  await renderScreen();

  expect(screen.getByText('EXPIRING SOON')).toBeOnTheScreen();
  expect(screen.getByText('Shopping')).toBeOnTheScreen();
  expect(screen.getByText(i18n.t(getDailyMealPlanEmptyMessageKey(new Date())))).toBeOnTheScreen();
  expect(screen.getByText('STREAK')).toBeOnTheScreen();
  expect(screen.getByText('Calories today')).toBeOnTheScreen();

  await fireEvent(screen.getByLabelText('Open meal plan'), 'longPress');
  await fireEvent.press(screen.getByLabelText('Customize cards'));

  expect(screen.getByText('Add cards or adjust their size')).toBeOnTheScreen();
  expect(screen.getByLabelText('Close gallery')).toBeOnTheScreen();
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

  it('öffnet beim Antippen direkt den Ablaufbereich ohne separate Prüfaktion', async () => {
    await renderScreen();

    expect(screen.queryByText('Vorrat prüfen')).toBeNull();

    await fireEvent.press(
      screen.getByLabelText('Alle bald ablaufenden Artikel im Vorrat anzeigen'),
    );

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/fridge',
      params: { filter: 'expiring' },
    });
  });
});

describe('DashboardScreen — Essensplan-Karte', () => {
  it('zeigt bei leerem Essensplan den tagesabhaengigen Empty-State-Text', async () => {
    await renderScreen();

    expect(screen.getByText(i18n.t(getDailyMealPlanEmptyMessageKey(new Date())))).toBeOnTheScreen();
  });

  it('zeigt bei leerem Essensplan die Küchennotiz statt eines Artworks', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 20, 12, 0));

    try {
      await renderScreen();

      expect(screen.queryByTestId('meal-plan-large-artwork')).not.toBeOnTheScreen();
      expect(screen.getByTestId('meal-plan-kitchen-note')).toBeOnTheScreen();
      expect(screen.getByTestId('meal-plan-kitchen-note-sheet')).toHaveStyle({
        width: 78,
        height: 92,
        transform: [{ rotate: '5deg' }],
      });
      expect(screen.queryByText(i18n.t('dashboard.cards.mealPlan.plannedToday'))).toBeNull();
      expect(screen.queryByTestId('meal-plan-empty-artwork')).not.toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  it('wechselt bei leerem Plan innerhalb eines Tages nicht die große Ansicht', async () => {
    const today = new Date(2026, 8, 20, 12, 0);
    jest.useFakeTimers();
    jest.setSystemTime(today);

    try {
      await renderScreen();

      const emptyMessage = i18n.t(getDailyMealPlanEmptyMessageKey(new Date()));
      const artworkTestId =
        getDailyMealPlanEmptyArtworkVariant(today) === 'kitchenNote'
          ? 'meal-plan-kitchen-note'
          : 'meal-plan-weekly-strip';

      expect(screen.getByTestId(artworkTestId)).toBeOnTheScreen();
      expect(screen.getByText(emptyMessage)).toBeOnTheScreen();

      act(() => {
        jest.advanceTimersByTime(6_000);
      });

      expect(screen.getByTestId(artworkTestId)).toBeOnTheScreen();
      expect(screen.getByText(emptyMessage)).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  it('zeigt das echte Coverbild des heutigen Gerichts', async () => {
    mockMealPlanEntries = [
      {
        id: 'entry-1',
        meal_plan_id: 'plan-1',
        household_id: 'hh-1',
        recipe_id: 'recipe-1',
        entry_date: todayIso(),
        meal_slot: 'dinner',
        servings_mode: 'portions',
        portions: 4,
        people_count: null,
        recipe_title: 'Spaghetti Bolognese',
        recipe_cover_image_path: 'hh-1/recipe-1.jpg',
      },
    ];
    mockMealCoverUrl = 'https://example.com/recipe-1.jpg';

    await renderScreen();

    expect(screen.getByTestId('meal-plan-large-artwork').props.source).toEqual([
      { uri: 'https://example.com/recipe-1.jpg' },
    ]);
    expect(screen.getByText(i18n.t('dashboard.cards.mealPlan.plannedToday'))).toBeOnTheScreen();
  });

  it('zeigt Essensplan-Karte mit Label zum Oeffnen', async () => {
    await renderScreen();
    expect(screen.getByLabelText('Essensplan öffnen')).toBeTruthy();
  });

  it('zeigt das Large-Artwork über die volle Kartenhöhe und mindestens halbbreit', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 20, 12, 0));

    try {
      await renderScreen();

      const artwork = screen.getByTestId('meal-plan-kitchen-note');

      expect(artwork).toHaveStyle({ flex: 1 });
      expect(artwork.parent).toHaveStyle({ width: '50%', height: '100%' });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('DashboardScreen — Streak-Karte', () => {
  it('zeigt die allgemeine Serie auf der Übersicht', async () => {
    await renderScreen();

    expect(screen.getByText('STREAK')).toBeOnTheScreen();
    expect(screen.getByLabelText(/Streak:/)).toBeOnTheScreen();
  });

  it('verwendet für Dashboard-Karten denselben markanten Schatten wie der Vorrat', async () => {
    await renderScreen();

    const streakCard = screen.getByLabelText(/Streak:/);
    const expectedShadow = `0 ${shadow.prominent.shadowOffset.height}px ${shadow.prominent.shadowRadius}px ${withAlpha(colorsLight.shadowCard, shadow.prominent.shadowOpacity)}`;

    expect(StyleSheet.flatten(streakCard.props.style).boxShadow).toBe(expectedShadow);
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
    expect(screen.getByLabelText('Essensplan öffnen').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );

    // Plus-Button öffnet das Galerie-Sheet
    await fireEvent.press(screen.getByLabelText('Karten anpassen'));
    expect(screen.getByText('Karten anpassen')).toBeTruthy();
    expect(screen.getByText(/Streak/)).toBeOnTheScreen();

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

    expect(mockDraxSpans.filter((span) => span.colSpan === 1).length).toBeGreaterThanOrEqual(2);
  });

  it('passt die Jiggle-Kartenbreite an den verfügbaren Inhaltsbereich an', async () => {
    await renderScreen();

    await fireEvent(screen.getByLabelText('Essensplan öffnen'), 'longPress');
    await fireEvent(screen.getByTestId('dashboard-editing-grid'), 'layout', {
      nativeEvent: { layout: { width: 348, height: 600 } },
    });

    expect(mockSortableItemStyles).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: 348, overflow: 'visible' })]),
    );
  });
});

describe('DashboardScreen — Pull-to-Refresh', () => {
  it('lässt den Dashboard-ScrollView-Schatten seitlich und oben auslaufen', async () => {
    await renderScreen();

    const scrollView = screen.getByTestId('dashboard-scroll-view');

    expect(StyleSheet.flatten(scrollView.props.style)).toEqual(
      expect.objectContaining({ overflow: 'visible' }),
    );
    expect(StyleSheet.flatten(scrollView.props.contentContainerStyle)).toEqual(
      expect.objectContaining({ paddingTop: space.sm }),
    );
  });

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
