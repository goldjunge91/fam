import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CONTENT_MAX_WIDTH } from '@/components/theme/index';
import { SettingsScreen } from '@/features/settings/settings-screen';
import { i18n } from '@/i18n';

const mockLanguageValues = new Map<string, string>();

jest.mock('@/lib/storage/device-storage', () => ({
  getDeviceStorage: () => ({
    getString: (key: string) => mockLanguageValues.get(key),
    set: (key: string, value: string) => mockLanguageValues.set(key, value),
  }),
}));

/**
 * Die Einstellungen sind ein Verzeichnis: eine Zeile je Thema, das Thema
 * selbst auf einer eigenen Seite. Geprueft wird genau das — dass die
 * Menuepunkte da sind und dass die Formulare, die frueher hier lagen, es
 * nicht mehr sind.
 */
let mockHouseholds: { id: string; name: string }[] = [{ id: 'hh-1', name: 'Familie Tozzi' }];
let mockActiveHousehold: { id: string; name: string } | null = mockHouseholds[0];
let mockAvatarUrl: string | null = null;

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
    hasPlus: false,
    isForced: false,
    customerInfo: null,
    loading: false,
    refresh: jest.fn(),
  }),
}));

jest.mock('@/features/premium/paywall', () => ({
  presentCustomerCenter: jest.fn(),
}));

jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({ openDrawer: jest.fn(), openProfile: jest.fn() }),
}));

jest.mock('@/features/navigation/use-profile-initials', () => ({
  useProfileInitials: () => 'MM',
}));

// Die lokale FAB-Praeferenz ist fuer diese Menue-Tests nur Darstellungszustand.
// Der synchrone Mock verhindert eine nach dem Rendern eintreffende Query-Aktualisierung.
jest.mock('@/features/navigation/fab-position-settings', () => ({
  DEFAULT_FAB_POSITION: 'right',
  useFabPosition: () => ({ data: 'right' }),
  useSetFabPosition: () => jest.fn(),
}));

jest.mock('@/features/profile/api', () => ({
  useProfile: () => ({ data: { display_name: 'Marco Müller', avatar_url: mockAvatarUrl } }),
}));

// `Screen` fragt den Router, ob es etwas zum Zurueckgehen gibt; ausserhalb
// eines Navigators gibt es dafuer keinen Zustand.
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
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

  beforeEach(async () => {
    await i18n.changeLanguage('de');
    mockLanguageValues.clear();
    mockHouseholds = [{ id: 'hh-1', name: 'Familie Tozzi' }];
    mockActiveHousehold = mockHouseholds[0];
    mockAvatarUrl = null;
    jest.mocked(router.push).mockClear();
    process.env.EXPO_PUBLIC_DEV_TOOLS = 'false';
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_DEV_TOOLS = originalDevTools;
    process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
  });

  it('zeigt die Menuepunkte statt der Formulare', async () => {
    const { getByText, queryByText, getByTestId, getByLabelText } = await renderScreen();
    const settingsScrollView = getByTestId('settings-scroll-view');

    // Die Einträge dürfen nicht nur im React-Baum existieren: Der ScrollView
    // braucht entlang der gesamten HubScreen-Kette einen echten Viewport.
    expect(settingsScrollView).toHaveStyle({ flex: 1 });
    expect(settingsScrollView.parent).toHaveStyle({
      flex: 1,
      width: '100%',
      maxWidth: CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    });
    expect(settingsScrollView.parent?.parent).toHaveStyle({ flex: 1 });

    const visibleMenu = within(settingsScrollView);
    for (const eintrag of ['Mitglieder', 'Lagerorte', 'Berechtigungen', 'Abmelden']) {
      expect(visibleMenu.getByText(eintrag)).toBeOnTheScreen();
    }
    expect(getByLabelText('Profil öffnen')).toBeOnTheScreen();

    // "Profil" ist keine eigene Zeile mehr, sondern die grosse Profil-Karte
    // oben (Name + E-Mail statt Label) — geprueft in
    // "beantwortet die haeufigsten Fragen ohne Antippen".
    for (const eintrag of [
      'Mitglieder',
      'Lagerorte',
      'Einkaufsliste',
      'Gamification',
      'Berechtigungen',
      'Benachrichtigungen',
      'Abmelden',
    ]) {
      expect(getByText(eintrag)).toBeTruthy();
    }

    // Kinder-Profile und Haushalt-Beitritt sind jetzt ausschliesslich unter
    // Mitglieder erreichbar, nicht mehr als eigene Zeile hier.
    expect(queryByText('Kinder-Profile')).toBeNull();
    expect(queryByText('Haushalt beitreten')).toBeNull();

    // Synchronisation ist keine eigene Settings-Zeile mehr: Status kommt vom
    // app-weiten SyncStatusBanner, manuelles Anstossen ueber Dashboard-Pull-
    // to-Refresh, die Detailseite bleibt nur ueber Entwickler-Werkzeuge erreichbar.
    expect(queryByText('Synchronisation')).toBeNull();

    // Diese Bedienelemente lagen frueher direkt auf der Uebersicht und gehoeren
    // jetzt auf die Unterseiten.
    expect(queryByText('Jetzt synchronisieren')).toBeNull();
    expect(queryByText('Sync-Diagnose & Outbox anzeigen')).toBeNull();
  });

  it('beantwortet die haeufigsten Fragen ohne Antippen', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Marco Müller')).toBeTruthy();
    expect(getByText('marco@example.com')).toBeTruthy();
    expect(getByText('Familie Tozzi')).toBeTruthy();
  });

  it('ordnet Profilbild, Profildaten und Pfeil in einer gemeinsamen Kartenzeile an', async () => {
    await renderScreen();

    const profileCard = screen.getByRole('button', { name: /Marco Müller/ });
    const profileCardRow = screen.getByTestId('settings-profile-card-row');

    expect(profileCard).toContainElement(profileCardRow);
    expect(profileCardRow).toHaveStyle({ flexDirection: 'row', alignItems: 'center' });
    expect(within(profileCardRow).getByText('marco@example.com')).toBeOnTheScreen();
    expect(within(profileCardRow).getByText('›')).toBeOnTheScreen();
  });

  it('zeigt das gespeicherte Profilbild im Settings-Header an', async () => {
    mockAvatarUrl = 'https://example.com/avatar.jpg';

    await renderScreen();

    expect(screen.getByLabelText('Profilbild in Einstellungen')).toHaveStyle({
      width: '100%',
      height: '100%',
    });
    expect(screen.getByLabelText('Profilbild')).toBeOnTheScreen();
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

  it('bietet ohne Plus/KI einen Einstieg zum Plus-&-KI-Screen an', async () => {
    await renderScreen();

    const promoButton = screen.getByRole('button', {
      name: /Plus & KI für den ganzen Haushalt/,
    });
    const promoSurface = screen.getByTestId('plus-and-ai-promo-surface');

    expect(promoButton).toContainElement(promoSurface);
    expect(promoSurface).toHaveStyle({ overflow: 'hidden', flexShrink: 0 });
    expect(within(promoSurface).getByText('Plus & KI für den ganzen Haushalt')).toBeVisible();
    expect(within(promoSurface).getByText('Plus & KI ansehen')).toBeVisible();
  });

  it('öffnet den Gamification-Screen aus den Einstellungen', async () => {
    await renderScreen();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Gamification' }));

    expect(router.push).toHaveBeenCalledWith('/gamification');
  });

  it('wechselt die App-Sprache über die Einstellungszeile', async () => {
    await renderScreen();
    const user = userEvent.setup();

    await user.press(screen.getByRole('radio', { name: 'Englisch' }));

    expect(await screen.findByRole('radio', { name: 'English', selected: true })).toBeOnTheScreen();
    expect(mockLanguageValues.get('fam:language')).toBe('en');
  });
});
