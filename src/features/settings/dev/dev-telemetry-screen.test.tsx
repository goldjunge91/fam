import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Observe } from 'expo-observe';
import { Alert, Platform } from 'react-native';
import { getAptabaseInitializationError, isAptabaseConfigured } from '@/lib/analytics/aptabase';
import { trackAnalyticsEvent } from '@/lib/analytics/events';
import {
  getPostHogClient,
  getPostHogInitializationError,
  isPostHogConfigured,
  reloadPostHogFeatureFlags,
  useFeatureFlags,
} from '@/lib/observability/providers/posthog';
import { sendTestNotification } from '@/lib/platform/notifications';
import { reportError } from '@/lib/telemetry';
import { DevTelemetryScreen } from './dev-telemetry-screen';

let mockHasAccess = true;
let mockFlags: Record<string, unknown> | undefined;
let mockPostHogConfigured = false;
let mockPostHogError: string | null = null;
let mockAptabaseConfigured = false;
let mockAptabaseError: string | null = null;
let mockReloadFlags: Record<string, unknown> | null = null;
let mockReloadError: unknown = null;
let mockClient: { getDistinctId: () => string } | null = null;
let mockNotificationResult = { success: true, message: 'Benachrichtigung geplant' };

jest.mock('expo-observe', () => ({
  Observe: { logEvent: jest.fn() },
}));

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Redirect: ({ href }: { href: string }) => React.createElement(Text, null, `Redirect: ${href}`),
  };
});

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
      onPress: () => void;
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
  };
});

jest.mock('@/features/settings/dev/dev-screen-shared', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    devStyles: { actionStack: {} },
    Zeile: ({ label, wert }: { label: string; wert: string }) =>
      React.createElement(Text, null, `${label}: ${wert}`),
  };
});

jest.mock('@/hooks/use-dev-tools-access', () => ({
  useDevToolsAccess: () => mockHasAccess,
}));

jest.mock('@/lib/analytics/aptabase', () => ({
  getAptabaseInitializationError: jest.fn(() => mockAptabaseError),
  isAptabaseConfigured: jest.fn(() => mockAptabaseConfigured),
}));

jest.mock('@/lib/analytics/events', () => ({ trackAnalyticsEvent: jest.fn() }));

jest.mock('@/lib/config/env', () => ({ env: { posthogHost: 'https://posthog.test' } }));

jest.mock('@/lib/observability/providers/posthog', () => ({
  getPostHogClient: jest.fn(() => mockClient),
  getPostHogInitializationError: jest.fn(() => mockPostHogError),
  isPostHogConfigured: jest.fn(() => mockPostHogConfigured),
  reloadPostHogFeatureFlags: jest.fn(async () => {
    if (mockReloadError !== null) throw mockReloadError;
    return mockReloadFlags;
  }),
  useFeatureFlags: jest.fn(() => mockFlags),
}));

jest.mock('@/lib/platform/notifications', () => ({ sendTestNotification: jest.fn() }));

jest.mock('@/lib/telemetry', () => ({ reportError: jest.fn() }));

describe('DevTelemetryScreen', () => {
  beforeEach(() => {
    mockHasAccess = true;
    mockFlags = undefined;
    mockPostHogConfigured = false;
    mockPostHogError = null;
    mockAptabaseConfigured = false;
    mockAptabaseError = null;
    mockReloadFlags = null;
    mockReloadError = null;
    mockClient = null;
    mockNotificationResult = { success: true, message: 'Benachrichtigung geplant' };
    jest.mocked(Observe.logEvent).mockClear();
    jest.mocked(trackAnalyticsEvent).mockClear();
    jest.mocked(getPostHogClient).mockClear();
    jest.mocked(getPostHogInitializationError).mockClear();
    jest.mocked(isPostHogConfigured).mockClear();
    jest.mocked(getAptabaseInitializationError).mockClear();
    jest.mocked(isAptabaseConfigured).mockClear();
    jest.mocked(useFeatureFlags).mockClear();
    jest.mocked(reloadPostHogFeatureFlags).mockClear();
    jest.mocked(sendTestNotification).mockReset();
    jest.mocked(sendTestNotification).mockImplementation(async () => mockNotificationResult);
    jest.mocked(reportError).mockClear();
  });

  afterEach(() => jest.restoreAllMocks());

  it('shows empty and loaded flag states and redirects without developer access', async () => {
    await render(<DevTelemetryScreen />);
    expect(screen.getByText('Geladene Flags: noch keine')).toBeOnTheScreen();

    mockFlags = { alpha: true, beta: false };
    const view = await render(<DevTelemetryScreen />);
    expect(screen.getByText('Geladene Flags: 2')).toBeOnTheScreen();
    await view.unmount();

    mockHasAccess = false;
    await render(<DevTelemetryScreen />);
    expect(screen.getByText('Redirect: /settings')).toBeOnTheScreen();
  });

  it('sends error, Observe, and notification test signals', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<DevTelemetryScreen />);

    await user.press(screen.getByRole('button', { name: 'Sentry-Testfehler senden' }));
    expect(reportError).toHaveBeenCalledWith(new Error('First error'), {
      operation: 'dev_tools.error_test',
      error_code: 'dev_tools_test_error',
    });
    expect(alert).toHaveBeenLastCalledWith(
      'Telemetrie',
      'Testfehler ("First error") wurde an Sentry, PostHog und Aptabase gesendet.',
    );

    await user.press(screen.getByRole('button', { name: 'EAS-Observe-Testevent senden' }));
    expect(Observe.logEvent).toHaveBeenCalledWith('dev_tools.test_event', {
      attributes: { source: 'dev-tools-screen', platform: Platform.OS },
    });
    expect(alert).toHaveBeenLastCalledWith(
      'EAS Observe',
      expect.stringContaining('dev_tools.test_event'),
    );

    await user.press(screen.getByRole('button', { name: 'Test-Benachrichtigung senden' }));
    await waitFor(() =>
      expect(alert).toHaveBeenLastCalledWith('Erfolg', 'Benachrichtigung geplant'),
    );
  });

  it('shows notification hints and handles thrown notification errors', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    mockNotificationResult = { success: false, message: 'Benachrichtigung nicht verfügbar' };
    await render(<DevTelemetryScreen />);

    await user.press(screen.getByRole('button', { name: 'Test-Benachrichtigung senden' }));
    await waitFor(() =>
      expect(alert).toHaveBeenLastCalledWith('Hinweis', 'Benachrichtigung nicht verfügbar'),
    );

    jest.mocked(sendTestNotification).mockRejectedValue(new Error('permission denied'));
    await user.press(screen.getByRole('button', { name: 'Test-Benachrichtigung senden' }));
    await waitFor(() =>
      expect(alert).toHaveBeenLastCalledWith('Fehlgeschlagen', 'permission denied'),
    );
  });

  it.each([
    [null, 'PostHog nicht aktiv'],
    ['client startup failed', 'PostHog-Clientfehler'],
  ] as const)('reports PostHog startup status and initialization error', async (error, title) => {
    mockPostHogError = error;
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<DevTelemetryScreen />);

    await user.press(screen.getByRole('button', { name: 'PostHog-Verbindung prüfen' }));

    await waitFor(() => expect(alert).toHaveBeenLastCalledWith(title, expect.any(String)));
    expect(screen.getByText(/PostHog-Verbindung:/)).toBeOnTheScreen();
  });

  it('shows successfully loaded PostHog flags and a missing client identifier', async () => {
    mockPostHogConfigured = true;
    mockReloadFlags = { 'test-feature': true, another: false };
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<DevTelemetryScreen />);

    await user.press(screen.getByRole('button', { name: 'PostHog-Verbindung prüfen' }));

    await waitFor(() =>
      expect(alert).toHaveBeenLastCalledWith(
        'PostHog funktioniert',
        expect.stringContaining('Nutzer: unbekannt'),
      ),
    );
    expect(screen.getByText('PostHog-Verbindung: erreichbar, 2 Flag(s) geladen')).toBeOnTheScreen();
  });

  it('handles an absent feature flag and a rejected PostHog connection check', async () => {
    mockPostHogConfigured = true;
    mockReloadFlags = null;
    mockClient = { getDistinctId: () => 'user-1' };
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<DevTelemetryScreen />);

    await user.press(screen.getByRole('button', { name: 'PostHog-Verbindung prüfen' }));
    await waitFor(() =>
      expect(alert).toHaveBeenLastCalledWith(
        'PostHog funktioniert',
        expect.stringContaining('test-feature: nicht angelegt'),
      ),
    );

    mockReloadError = new Error('network unavailable');
    await user.press(screen.getByRole('button', { name: 'PostHog-Verbindung prüfen' }));
    await waitFor(() =>
      expect(alert).toHaveBeenLastCalledWith(
        'PostHog nicht erreichbar',
        expect.stringContaining('network unavailable'),
      ),
    );
  });

  it('sends telemetry only when at least one analytics provider is configured', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    mockAptabaseError = 'init failed';
    await render(<DevTelemetryScreen />);

    await user.press(screen.getByRole('button', { name: 'Telemetrie-Testevent senden' }));
    expect(alert).toHaveBeenLastCalledWith(
      'Telemetrie nicht aktiv',
      'Initialisierung fehlgeschlagen: init failed',
    );

    mockAptabaseError = null;
    await user.press(screen.getByRole('button', { name: 'Telemetrie-Testevent senden' }));
    expect(alert).toHaveBeenLastCalledWith(
      'Telemetrie nicht aktiv',
      'nicht aktiv: Telemetrie-API-Keys sind in diesem Build nicht vorhanden',
    );

    mockAptabaseConfigured = true;
    await user.press(screen.getByRole('button', { name: 'Telemetrie-Testevent senden' }));
    expect(trackAnalyticsEvent).toHaveBeenCalledWith(
      'dev_tools.telemetry_test.completed',
      expect.objectContaining({ platform: Platform.OS, source: 'dev-tools-screen' }),
    );
    expect(alert).toHaveBeenLastCalledWith(
      'Telemetrie',
      'Test-Event ("dev_tools.telemetry_test.completed") wurde an PostHog und Aptabase gesendet.',
    );
    expect(isAptabaseConfigured).toHaveBeenCalled();
    expect(getAptabaseInitializationError).toHaveBeenCalled();
  });
});
