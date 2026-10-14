import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { DevDataScreen } from './dev-data-screen';

let mockHasAccess = true;
let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } };
let mockDbError: unknown = null;
let mockDatabaseRows: Record<string, unknown> = {};
let mockOffDumpStatus = {
  attached: false,
  fileExists: false,
  fileSizeBytes: 0,
  schemaVersion: null as number | null,
  dataVersion: null as string | null,
  lastCheckAt: null as string | null,
  lastSuccessfulUpdateAt: null as string | null,
  lastError: null as string | null,
};

const mockGetFirstAsync = jest.fn(async (query: string) => mockDatabaseRows[query]);
const mockGetDatabase = jest.fn(async () => {
  if (mockDbError !== null) throw mockDbError;
  return { getFirstAsync: mockGetFirstAsync };
});
const mockQueryClient = { resetQueries: jest.fn() };
const mockDeleteLocalDatabase = jest.fn();
const mockForceRefreshOffDump = jest.fn();
const mockReinstallOffDumpBaseline = jest.fn();
const mockCheckOffDumpIntegrity = jest.fn();
const mockGetOffDumpStatus = jest.fn(async () => mockOffDumpStatus);

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockQueryClient,
}));

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, `Redirect: ${href}`);
  },
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));

const mockRouterPush = jest.fn();

jest.mock('@/components/layout/screen', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return {
    Screen: ({ title, children }: { title: string; children: React.ReactNode }) =>
      React.createElement(View, null, React.createElement(Text, null, title), children),
  };
});

jest.mock('@/components/ui/content-card', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return {
    ContentCard: ({ title, children }: { title: string; children: React.ReactNode }) =>
      React.createElement(View, null, React.createElement(Text, null, title), children),
  };
});

jest.mock('@/constants/ui', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({
      title,
      onPress,
      loading,
    }: {
      title: string;
      onPress: () => void | Promise<void>;
      loading?: boolean;
    }) =>
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          accessibilityState: { busy: loading },
          onPress: () => {
            void onPress();
          },
        },
        React.createElement(Text, null, title),
      ),
    Txt: ({ children }: { children: React.ReactNode }) => React.createElement(Text, null, children),
  };
});

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockSession }),
}));

jest.mock('@/features/settings/dev/dev-info', () => ({
  describeDatabaseOwnership: (storedUserId: string | null, sessionUserId: string | null) => ({
    label:
      sessionUserId === null
        ? 'nicht angemeldet'
        : storedUserId === sessionUserId
          ? 'stimmt überein'
          : 'fremd',
    tone: sessionUserId === null ? 'warning' : storedUserId === sessionUserId ? 'accent' : 'danger',
  }),
}));

jest.mock('@/hooks/use-dev-tools-access', () => ({
  useDevToolsAccess: () => mockHasAccess,
}));

jest.mock('@/lib/db/local-client', () => ({
  deleteLocalDatabase: (...args: unknown[]) => mockDeleteLocalDatabase(...args),
  getDatabase: () => mockGetDatabase(),
}));

jest.mock('@/lib/off-dump/off-dump', () => ({
  checkOffDumpIntegrity: (...args: unknown[]) => mockCheckOffDumpIntegrity(...args),
  forceRefreshOffDump: (...args: unknown[]) => mockForceRefreshOffDump(...args),
  getOffDumpStatus: () => mockGetOffDumpStatus(),
  reinstallOffDumpBaseline: (...args: unknown[]) => mockReinstallOffDumpBaseline(...args),
}));

jest.mock('@/lib/sync/backoff', () => ({ MAX_ATTEMPTS: 5 }));

jest.mock('./dev-screen-shared', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    devStyles: { actionStack: {} },
    formatBytes: (value: number) => `${value} bytes`,
    formatZeitpunkt: (value: string | null) => value ?? '—',
    Zeile: ({ label, wert }: { label: string; wert: string }) =>
      React.createElement(Text, null, `${label}: ${wert}`),
  };
});

function emptyOffDumpStatus() {
  return {
    attached: false,
    fileExists: false,
    fileSizeBytes: 0,
    schemaVersion: null,
    dataVersion: null,
    lastCheckAt: null,
    lastSuccessfulUpdateAt: null,
    lastError: null,
  };
}

describe('DevDataScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasAccess = true;
    mockSession = { user: { id: 'user-1' } };
    mockDbError = null;
    mockDatabaseRows = {
      'PRAGMA user_version': { user_version: 12 },
      'select value from app_meta where key = ?': { value: 'user-1' },
      'select count(*) as c from outbox where attempts < ?': { c: 2 },
      'select count(*) as c from outbox where attempts >= ?': { c: 1 },
      'select count(*) as c from fridge_items': { c: 4 },
      'select count(*) as c from shopping_list_items': { c: 5 },
      'select count(*) as c from storage_locations': { c: 3 },
    };
    mockOffDumpStatus = emptyOffDumpStatus();
    mockGetFirstAsync.mockImplementation(async (query: string) => mockDatabaseRows[query]);
    mockGetDatabase.mockImplementation(async () => {
      if (mockDbError !== null) throw mockDbError;
      return { getFirstAsync: mockGetFirstAsync };
    });
    mockGetOffDumpStatus.mockImplementation(async () => mockOffDumpStatus);
  });

  afterEach(() => jest.restoreAllMocks());

  it('leitet ohne Entwicklerzugriff weiter', async () => {
    mockHasAccess = false;
    await render(<DevDataScreen />);

    expect(screen.getByText('Redirect: /settings')).toBeOnTheScreen();
  });

  it('lädt Datenbankzahlen, Besitz und den leeren Dumpstatus', async () => {
    await render(<DevDataScreen />);

    expect(await screen.findByText('Gehört Nutzer: stimmt überein')).toBeOnTheScreen();
    expect(screen.getByText('Schema-Version: 12')).toBeOnTheScreen();
    expect(screen.getByText('Outbox: 2 offen · 1 fehlgeschlagen')).toBeOnTheScreen();
    expect(screen.getByText('Zeilen: 4 Vorrat · 5 Einkauf · 3 Orte')).toBeOnTheScreen();
    expect(screen.getByText('Heruntergeladen: nein')).toBeOnTheScreen();
    expect(screen.getByText('Angehängt: nein')).toBeOnTheScreen();
    expect(mockGetFirstAsync).toHaveBeenCalledWith(
      'select count(*) as c from outbox where attempts < ?',
      [5],
    );
  });

  it('zeigt vorhandene Dumpdetails sowie Nutzerabweichung und fehlende Zähler', async () => {
    mockSession = { user: { id: 'different-user' } };
    mockDatabaseRows['select value from app_meta where key = ?'] = { value: 'stored-user' };
    mockDatabaseRows['select count(*) as c from fridge_items'] = undefined;
    mockOffDumpStatus = {
      attached: true,
      fileExists: true,
      fileSizeBytes: 2048,
      schemaVersion: 7,
      dataVersion: '2026-10-01',
      lastCheckAt: '2026-10-02',
      lastSuccessfulUpdateAt: '2026-10-03',
      lastError: 'checksum mismatch',
    };

    await render(<DevDataScreen />);

    expect(await screen.findByText('Gehört Nutzer: fremd')).toBeOnTheScreen();
    expect(screen.getByText('Outbox: 2 offen · 1 fehlgeschlagen')).toBeOnTheScreen();
    expect(screen.getByText('Zeilen: 0 Vorrat · 5 Einkauf · 3 Orte')).toBeOnTheScreen();
    expect(screen.getByText('Heruntergeladen: ja · 2048 bytes')).toBeOnTheScreen();
    expect(screen.getByText('Angehängt: ja')).toBeOnTheScreen();
    expect(screen.getByText('Letzter Fehler: checksum mismatch')).toBeOnTheScreen();
  });

  it('zeigt Datenbankfehler und kann den Snapshot neu einlesen', async () => {
    mockDbError = new Error('database unavailable');
    const user = userEvent.setup();
    await render(<DevDataScreen />);

    expect(await screen.findByText('Nicht lesbar: database unavailable')).toBeOnTheScreen();

    mockDbError = 'unexpected failure';
    await user.press(screen.getByRole('button', { name: 'Neu einlesen' }));
    expect(await screen.findByText('Nicht lesbar: unexpected failure')).toBeOnTheScreen();
  });

  it('öffnet die Sync-Diagnose und löscht nach Bestätigung nur lokale Daten', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<DevDataScreen />);

    await user.press(screen.getByRole('button', { name: 'Sync-Diagnose & Outbox öffnen' }));
    expect(mockRouterPush).toHaveBeenCalledWith('/settings/sync-debug');

    await user.press(screen.getByRole('button', { name: 'Lokale Datenbank löschen' }));
    expect(alert).toHaveBeenLastCalledWith(
      'Lokale Datenbank löschen?',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Abbrechen', style: 'cancel' }),
        expect.objectContaining({ text: 'Löschen', style: 'destructive' }),
      ]),
    );
    const actions = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    const wipe = actions?.find((action) => action.text === 'Löschen');
    await act(async () => {
      await wipe?.onPress?.();
    });

    expect(mockDeleteLocalDatabase).toHaveBeenCalled();
    expect(mockQueryClient.resetQueries).toHaveBeenCalled();
  });

  it('aktualisiert und installiert die Baseline nur nach Bestätigung', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<DevDataScreen />);

    await user.press(screen.getByRole('button', { name: 'Jetzt aktualisieren' }));
    await waitFor(() => expect(mockForceRefreshOffDump).toHaveBeenCalled());
    expect(mockGetOffDumpStatus).toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'Baseline neu installieren' }));
    expect(alert).toHaveBeenLastCalledWith(
      'Baseline neu installieren?',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Abbrechen', style: 'cancel' }),
        expect.objectContaining({ text: 'Neu installieren' }),
      ]),
    );
    const actions = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    await act(async () => {
      await actions?.find((action) => action.text === 'Neu installieren')?.onPress?.();
    });
    expect(mockReinstallOffDumpBaseline).toHaveBeenCalled();
  });

  it('meldet beide Integritätsergebnisse und zeigt Aktualisierungsfehler', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    mockCheckOffDumpIntegrity.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await render(<DevDataScreen />);

    await user.press(screen.getByRole('button', { name: 'Integrität prüfen' }));
    await waitFor(() =>
      expect(alert).toHaveBeenLastCalledWith(
        'Integritätsprüfung',
        'Der OpenFoodFacts-Dump ist intakt.',
      ),
    );
    await user.press(screen.getByRole('button', { name: 'Integrität prüfen' }));
    await waitFor(() =>
      expect(alert).toHaveBeenLastCalledWith(
        'Integritätsprüfung',
        'Der OpenFoodFacts-Dump ist beschädigt.',
      ),
    );

    mockForceRefreshOffDump.mockRejectedValue(new Error('refresh failed'));
    await user.press(screen.getByRole('button', { name: 'Jetzt aktualisieren' }));
    await waitFor(() => expect(alert).toHaveBeenLastCalledWith('Fehlgeschlagen', 'refresh failed'));
  });
});
