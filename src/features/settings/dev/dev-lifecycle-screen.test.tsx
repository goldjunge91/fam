import { render, screen } from '@testing-library/react-native';
import type React from 'react';
import type { LifecycleLogEvent } from '@/lib/telemetry/lifecycle-log';
import { DevLifecycleScreen } from './dev-lifecycle-screen';

let mockHasAccess = true;
let mockStoredMarker: string | undefined;
let mockEvents: LifecycleLogEvent[] = [];
let mockSession: { user: { id: string } } | null = null;

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
  const { Text } = require('react-native');
  return {
    Txt: ({ children }: { children: React.ReactNode }) => React.createElement(Text, null, children),
  };
});

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockSession }),
}));

jest.mock('@/hooks/use-dev-tools-access', () => ({
  useDevToolsAccess: () => mockHasAccess,
}));

jest.mock('@/lib/storage/local-device-storage', () => ({
  getDeviceStorage: () => ({ getString: () => mockStoredMarker }),
}));

jest.mock('@/lib/telemetry/lifecycle-log', () => ({
  getLifecycleLog: () => mockEvents,
}));

describe('DevLifecycleScreen', () => {
  beforeEach(() => {
    mockHasAccess = true;
    mockStoredMarker = undefined;
    mockEvents = [];
    mockSession = null;
  });

  it('shows empty session and event state when storage has no marker or events', async () => {
    await render(<DevLifecycleScreen />);

    expect(screen.getByText('Lifecycle & Background')).toBeOnTheScreen();
    expect(screen.getByText('Aktuelle Session')).toBeOnTheScreen();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getByText('Ereignisse (0)')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Noch keine Lifecycle-Ereignisse aufgezeichnet. Wechsle die App in den Hintergrund und kehre zurueck.',
      ),
    ).toBeOnTheScreen();
  });

  it('shows the session marker and newest-first event details with level tones', async () => {
    mockStoredMarker = JSON.stringify({
      sessionId: 'session-123',
      state: 'open',
      startedAt: 1_790_000_000_000,
      lastEventAt: 1_790_000_100_000,
      lastAppState: 'background',
      lastOperation: 'sync',
      lastRoute: '/shopping-list',
    });
    mockSession = { user: { id: 'user-123' } };
    mockEvents = [
      { at: 1_790_000_000_000, name: 'app.active', level: 'debug' },
      { at: Number.NaN, name: 'app.warning', level: 'warn', detail: 'network slow' },
      { at: 1_790_000_100_000, name: 'app.crashed', level: 'error', detail: 'resume failed' },
    ];

    await render(<DevLifecycleScreen />);

    expect(screen.getByText('open')).toBeOnTheScreen();
    expect(screen.getByText('session-123')).toBeOnTheScreen();
    expect(screen.getByText('background')).toBeOnTheScreen();
    expect(screen.getByText('sync')).toBeOnTheScreen();
    expect(screen.getByText('/shopping-list')).toBeOnTheScreen();
    expect(screen.getByText('user-123')).toBeOnTheScreen();
    expect(screen.getByText('Ereignisse (3)')).toBeOnTheScreen();
    expect(screen.getByText('app.crashed')).toBeOnTheScreen();
    expect(screen.getByText('resume failed')).toBeOnTheScreen();
    expect(screen.getByText('app.warning')).toBeOnTheScreen();
    expect(screen.getByText('network slow')).toBeOnTheScreen();
    expect(screen.getByText('—')).toBeOnTheScreen();
  });

  it('treats a malformed stored marker as unavailable and redirects without access', async () => {
    mockStoredMarker = '{';
    const view = await render(<DevLifecycleScreen />);
    expect(screen.getByText('Session-ID')).toBeOnTheScreen();
    await view.unmount();

    mockHasAccess = false;
    await render(<DevLifecycleScreen />);
    expect(screen.getByText('Redirect: /settings')).toBeOnTheScreen();
  });
});
