import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { act } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DashboardScreen } from '@/features/dashboard/dashboard-screen';

jest.mock('@/components/progress-ring', () => ({ ProgressRing: () => null }));

let mockFridgeItems: unknown[] = [];

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
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
}));

jest.mock('@/features/fridge/use-fridge-items', () => ({
  useFridgeItems: () => ({ data: mockFridgeItems, isLoading: false }),
}));

jest.mock('@/features/fridge/use-fridge-mutations', () => ({
  useUpdateFridgeItemQuantityMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

jest.mock('@/features/fridge/use-expiry-notifications', () => ({
  useExpiryNotifications: () => {},
}));

jest.mock('@/features/shopping-list/use-shopping-list-mutations', () => ({
  useAddShoppingItem: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

const mockTriggerHouseholdSync = jest.fn().mockResolvedValue(null);

jest.mock('@/lib/sync/sync-runner', () => ({
  triggerHouseholdSync: (...args: unknown[]) => mockTriggerHouseholdSync(...args),
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    background: '#FFFFFF',
    backgroundElement: '#F0F0F3',
    text: '#000000',
    textSecondary: '#60646C',
    border: '#DDDDE3',
    accent: '#208AEF',
    success: '#1A7F4B',
    warning: '#B26A00',
    danger: '#C62828',
  }),
}));

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
});

describe('DashboardScreen — "Läuft bald ab"-Karte (#73)', () => {
  it('blendet die Karte komplett aus, wenn keine Artikel bald ablaufen', async () => {
    mockFridgeItems = [];
    await renderScreen();
    expect(screen.queryByText('Läuft bald ab')).not.toBeOnTheScreen();
  });

  it('zeigt die Karte mit Artikeln, wenn welche bald ablaufen', async () => {
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
    expect(screen.getByText('Joghurt')).toBeTruthy();
  });

  it('navigiert bei Tap auf die Karte zur gefilterten Vorratsliste', async () => {
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
    await fireEvent.press(
      screen.getByLabelText('Alle bald ablaufenden Artikel im Vorrat anzeigen'),
    );

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/fridge',
      params: { filter: 'expiring' },
    });
  });
});

describe('DashboardScreen — Pull-to-Refresh (#93)', () => {
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
