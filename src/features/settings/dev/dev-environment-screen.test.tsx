import { render, screen } from '@testing-library/react-native';
import type React from 'react';
import { Platform } from 'react-native';
import { DevEnvironmentScreen } from './dev-environment-screen';

let mockHasAccess = true;
let mockSession: { expires_at?: number; user: { id: string; email?: string } } | null = null;
let mockHousehold: { id: string; name: string } | null = null;
let mockPremium = { hasPlus: false, hasAI: false, isForced: false, isAiForced: false };
let mockAdsEnabled = true;
let mockPostHogConfigured = false;
let mockPostHogError: string | null = null;
let mockAptabaseConfigured = false;
let mockAptabaseError: string | null = null;

jest.mock('expo-application', () => ({
  nativeApplicationVersion: null,
  nativeBuildVersion: null,
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '9.8.7' } },
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

jest.mock('./dev-screen-shared', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Zeile: ({ label, wert }: { label: string; wert: string }) =>
      React.createElement(Text, null, `${label}: ${wert}`),
  };
});

jest.mock('@/features/ads', () => ({ useAdsEnabled: () => mockAdsEnabled }));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockSession }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHousehold: mockHousehold }),
}));

jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => mockPremium,
}));

jest.mock('@/features/settings/dev/dev-info', () => ({
  classifySupabaseTarget: () => ({ kind: 'lokal', label: 'Lokal', tone: 'accent' }),
  formatTokenExpiry: (expiresAt: number | undefined) =>
    expiresAt === undefined ? 'unbekannt' : expiresAt <= 1 ? 'abgelaufen' : 'noch 1 min',
  maskSecret: (value: string) => (value.length > 8 ? `${value.slice(0, 8)}…` : '…'),
}));

jest.mock('@/hooks/use-dev-tools-access', () => ({
  useDevToolsAccess: () => mockHasAccess,
}));

jest.mock('@/lib/analytics/aptabase', () => ({
  getAptabaseInitializationError: () => mockAptabaseError,
  isAptabaseConfigured: () => mockAptabaseConfigured,
}));

jest.mock('@/lib/config/env', () => ({
  env: {
    supabaseUrl: 'http://127.0.0.1:54321',
    supabaseKey: 'public-anon-key-1234',
    forceOnboarding: false,
  },
}));

jest.mock('@/lib/observability/providers/posthog', () => ({
  getPostHogInitializationError: () => mockPostHogError,
  isPostHogConfigured: () => mockPostHogConfigured,
}));

describe('DevEnvironmentScreen', () => {
  beforeEach(() => {
    mockHasAccess = true;
    mockSession = null;
    mockHousehold = null;
    mockPremium = { hasPlus: false, hasAI: false, isForced: false, isAiForced: false };
    mockAdsEnabled = true;
    mockPostHogConfigured = false;
    mockPostHogError = null;
    mockAptabaseConfigured = false;
    mockAptabaseError = null;
  });

  it('shows the local environment and inactive service defaults', async () => {
    await render(<DevEnvironmentScreen />);

    expect(screen.getByText('Umgebung & Zugang')).toBeOnTheScreen();
    expect(screen.getByText('Supabase: Lokal')).toBeOnTheScreen();
    expect(screen.getByText('Schlüssel: public-a…')).toBeOnTheScreen();
    expect(
      screen.getByText(`App-Version: 9.8.7 (Build —, ${Platform.OS} ${Platform.Version})`),
    ).toBeOnTheScreen();
    expect(screen.getByText('Onboarding erzwungen: nein')).toBeOnTheScreen();
    expect(screen.getByText('Plus: inaktiv')).toBeOnTheScreen();
    expect(screen.getByText('KI: inaktiv')).toBeOnTheScreen();
    expect(screen.getByText('Werbung: an')).toBeOnTheScreen();
    expect(screen.getByText('PostHog: kein API-Key')).toBeOnTheScreen();
    expect(screen.getByText('Aptabase: kein App-Key')).toBeOnTheScreen();
    expect(screen.getByText('Token gültig: unbekannt')).toBeOnTheScreen();
    expect(screen.getByText('Aktiver Haushalt: —')).toBeOnTheScreen();
    expect(screen.getByText('Haushalts-ID: —')).toBeOnTheScreen();
  });

  it('shows an active session, forced entitlements, configured analytics, and init errors', async () => {
    mockSession = {
      expires_at: 1,
      user: { id: 'user-1', email: 'marco@example.com' },
    };
    mockHousehold = { id: 'household-1', name: 'Familie' };
    mockPremium = { hasPlus: true, hasAI: true, isForced: true, isAiForced: true };
    mockAdsEnabled = false;
    mockPostHogConfigured = true;
    mockAptabaseError = 'missing key';

    await render(<DevEnvironmentScreen />);

    expect(screen.getByText('Plus: aktiv (erzwungen)')).toBeOnTheScreen();
    expect(screen.getByText('KI: aktiv (erzwungen)')).toBeOnTheScreen();
    expect(screen.getByText('Werbung: aus')).toBeOnTheScreen();
    expect(screen.getByText('PostHog: konfiguriert')).toBeOnTheScreen();
    expect(screen.getByText('Aptabase: Init fehlgeschlagen')).toBeOnTheScreen();
    expect(screen.getByText('Nutzer-ID: user-1')).toBeOnTheScreen();
    expect(screen.getByText('E-Mail: marco@example.com')).toBeOnTheScreen();
    expect(screen.getByText('Token gültig: abgelaufen')).toBeOnTheScreen();
    expect(screen.getByText('Aktiver Haushalt: Familie')).toBeOnTheScreen();
    expect(screen.getByText('Haushalts-ID: household-1')).toBeOnTheScreen();
  });

  it('shows ordinary Plus and AI entitlements and provider startup failures', async () => {
    mockSession = { expires_at: 120, user: { id: 'user-2' } };
    mockPremium = { hasPlus: true, hasAI: true, isForced: false, isAiForced: false };
    mockPostHogError = 'startup failed';
    mockAptabaseError = 'startup failed';

    await render(<DevEnvironmentScreen />);

    expect(screen.getByText('Plus: aktiv')).toBeOnTheScreen();
    expect(screen.getByText('KI: aktiv')).toBeOnTheScreen();
    expect(screen.getByText('Werbung: an')).toBeOnTheScreen();
    expect(screen.getByText('PostHog: Client-Start fehlgeschlagen')).toBeOnTheScreen();
    expect(screen.getByText('Aptabase: Init fehlgeschlagen')).toBeOnTheScreen();
    expect(screen.getByText('Token gültig: noch 1 min')).toBeOnTheScreen();
  });

  it('redirects when developer access is unavailable', async () => {
    mockHasAccess = false;
    await render(<DevEnvironmentScreen />);

    expect(screen.getByText('Redirect: /settings')).toBeOnTheScreen();
  });
});
