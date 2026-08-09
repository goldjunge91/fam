import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SettingsScreen } from '@/features/settings/settings-screen';

/**
 * Die Einstellungen sind ein Verzeichnis: eine Zeile je Thema, das Thema
 * selbst auf einer eigenen Seite. Geprueft wird genau das — dass die
 * Menuepunkte da sind und dass die Formulare, die frueher hier lagen, es
 * nicht mehr sind.
 */
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

jest.mock('@/hooks/use-sync-status', () => ({
  useSyncStatus: () => ({ kind: 'failed', failedCount: 2 }),
}));

jest.mock('@/lib/db/client', () => ({
  getDatabase: jest.fn(),
}));

// `Screen` fragt den Router, ob es etwas zum Zurueckgehen gibt; ausserhalb
// eines Navigators gibt es dafuer keinen Zustand.
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // `Screen` liest die Safe-Area-Insets; ohne Provider und ohne gemessene
  // Rahmenwerte wirft der Hook.
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
      'Profil',
      'Mitglieder',
      'Kinder-Profile',
      'Lagerorte',
      'Benachrichtigungen',
      'Synchronisation',
      'Abmelden',
    ]) {
      expect(getByText(eintrag)).toBeTruthy();
    }

    // Diese Bedienelemente lagen frueher direkt auf der Uebersicht und gehoeren
    // jetzt auf die Unterseiten.
    expect(queryByText('Jetzt synchronisieren')).toBeNull();
    expect(queryByText('Sync-Diagnose & Outbox anzeigen')).toBeNull();
  });

  it('beantwortet die haeufigsten Fragen ohne Antippen', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('marco@example.com')).toBeTruthy();
    expect(getByText('Familie Tozzi')).toBeTruthy();
    // Der Sync-Zustand steht als Kurzfassung in der Zeile.
    expect(getByText('2 fehlgeschlagen')).toBeTruthy();
  });

  it('blendet den Entwickler-Bereich ohne Flag aus', async () => {
    const { queryByText } = await renderScreen();
    expect(queryByText('Entwickler-Werkzeuge')).toBeNull();
  });

  it('zeigt den Entwickler-Bereich samt Ziel-Projekt, sobald das Flag gesetzt ist', async () => {
    process.env.EXPO_PUBLIC_DEV_TOOLS = 'true';

    const { getByText } = await renderScreen();

    expect(getByText('Entwickler-Werkzeuge')).toBeTruthy();
    // Ob der Build gegen die echten Daten laeuft, steht schon in der Uebersicht.
    expect(getByText('Lokal')).toBeTruthy();
  });

  it('bietet ohne Haushalt keine Haushalts-Unterseiten an, aber den Beitritt', async () => {
    mockHouseholds = [];
    mockActiveHousehold = null;

    const { getByText } = await renderScreen();

    expect(getByText('Kein Haushalt')).toBeTruthy();
    expect(getByText('Erst einem Haushalt beitreten')).toBeTruthy();
    expect(getByText('Haushalt beitreten')).toBeTruthy();
  });
});
