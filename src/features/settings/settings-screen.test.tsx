import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SettingsScreen } from '@/features/settings/settings-screen';

let mockHouseholds: { id: string; name: string }[] = [{ id: 'hh-1', name: 'Familie Tozzi' }];
let mockActiveHousehold: { id: string; name: string } | null = mockHouseholds[0];

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({
    session: { user: { id: 'user-1', email: 'marco@example.com' } },
    isLoading: false,
    seenOnboarding: true,
    error: null,
  }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({
    activeHousehold: mockActiveHousehold,
    activeHouseholdId: mockActiveHousehold?.id ?? null,
    households: mockHouseholds,
    isLoading: false,
    setActiveHouseholdId: jest.fn(),
  }),
}));

jest.mock('@/features/calorie-tracking/api', () => ({
  useCurrentGoal: () => ({ data: null, isLoading: false }),
}));

jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => ({
    isPremium: false,
    isForced: false,
    customerInfo: null,
    loading: false,
    refresh: jest.fn(),
  }),
}));

jest.mock('@/features/premium/paywall', () => ({
  presentPaywall: jest.fn(),
  presentPaywallIfNeeded: jest.fn(),
  presentCustomerCenter: jest.fn(),
}));

jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({ openDrawer: jest.fn(), openProfile: jest.fn() }),
}));

jest.mock('@/features/navigation/use-profile-initials', () => ({
  useProfileInitials: () => 'MM',
}));

// Synchron halten, damit nach dem Rendern keine Query-Aktualisierung eintrifft.
jest.mock('@/features/navigation/fab-position-settings', () => ({
  DEFAULT_FAB_POSITION: 'right',
  useFabPosition: () => ({ data: 'right' }),
  useSetFabPosition: () => jest.fn(),
}));

jest.mock('@/features/auth/api', () => ({
  useProfile: () => ({ data: { display_name: 'Marco Müller' } }),
}));

// Ausserhalb eines Navigators hat `Screen` keinen Zurueck-Zustand.
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  // `Screen` benoetigt gemessene Safe-Area-Werte.
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <QueryClientProvider client={queryClient}>
        <SettingsScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe('SettingsScreen', () => {
  const originalDevTools = process.env.EXPO_PUBLIC_DEV_TOOLS;
  const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

  beforeEach(() => {
    mockHouseholds = [{ id: 'hh-1', name: 'Familie Tozzi' }];
    mockActiveHousehold = mockHouseholds[0];
    process.env.EXPO_PUBLIC_DEV_TOOLS = 'false';
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_DEV_TOOLS = originalDevTools;
    process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
  });

  it('zeigt die Menuepunkte statt der Formulare', async () => {
    const { getByText, queryByText } = await renderScreen();

    for (const eintrag of [
      'Mitglieder',
      'Lagerorte',
      'Berechtigungen',
      'Benachrichtigungen',
      'Abmelden',
    ]) {
      expect(getByText(eintrag)).toBeTruthy();
    }

    expect(queryByText('Kinder-Profile')).toBeNull();
    expect(queryByText('Haushalt beitreten')).toBeNull();

    expect(queryByText('Synchronisation')).toBeNull();

    expect(queryByText('Jetzt synchronisieren')).toBeNull();
    expect(queryByText('Sync-Diagnose & Outbox anzeigen')).toBeNull();
  });

  it('beantwortet die haeufigsten Fragen ohne Antippen', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Marco Müller')).toBeTruthy();
    expect(getByText('marco@example.com')).toBeTruthy();
    expect(getByText('Familie Tozzi')).toBeTruthy();
  });

  it('blendet den Entwickler-Bereich ohne Flag aus', async () => {
    const { queryByText } = await renderScreen();
    expect(queryByText('Entwickler-Werkzeuge')).toBeNull();
  });

  it('zeigt den Entwickler-Bereich samt Ziel-Projekt, sobald das Flag gesetzt ist', async () => {
    process.env.EXPO_PUBLIC_DEV_TOOLS = 'true';

    const { getByText } = await renderScreen();

    expect(getByText('Entwickler-Werkzeuge')).toBeTruthy();
    expect(getByText('Lokal')).toBeTruthy();
  });

  it('bietet ohne Haushalt keine Haushalts-Unterseiten an, aber Mitglieder bleibt der Weg zum Beitritt', async () => {
    mockHouseholds = [];
    mockActiveHousehold = null;

    const { getByText } = await renderScreen();

    expect(getByText('Kein Haushalt')).toBeTruthy();
    expect(getByText('Haushalt wechseln oder beitreten')).toBeTruthy();
    expect(getByText('Mitglieder')).toBeTruthy();
  });

  it('zeigt die App-Version im Fussbereich an (#94)', async () => {
    const { getByText } = await renderScreen();
    expect(getByText('fam v1.0.0')).toBeTruthy();
  });

  it('bietet ohne Premium einen Einstieg zum Premium-Screen an', async () => {
    const { getByText } = await renderScreen();
    expect(getByText('Premium für den ganzen Haushalt')).toBeTruthy();
    expect(getByText('Premium ansehen')).toBeTruthy();
  });
});
