import { render, screen } from '@testing-library/react-native';
import type { PropsWithChildren, ReactNode } from 'react';

import { RootNavigator } from './root-navigator';

let mockSessionState: {
  session: { user: { id: string } } | null;
  accountReady: boolean;
  isLoading: boolean;
  seenOnboarding: boolean;
  error?: Error | null;
  retry?: () => void;
};
let mockDevTools = false;
let mockForceOnboarding = false;
let mockPathname = '/';
const mockGetDatabase = jest.fn().mockResolvedValue({});
const mockInitOffDump = jest.fn();

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const Stack = Object.assign(({ children }: PropsWithChildren) => children, {
    Screen: ({ name }: { name: string }) => React.createElement(Text, null, name),
    Protected: ({ children, guard }: { children: ReactNode; guard: boolean }) =>
      guard ? children : null,
  });

  return {
    Redirect: ({ href }: { href: string }) => React.createElement(Text, null, `redirect:${href}`),
    Stack,
    usePathname: () => mockPathname,
  };
});
jest.mock('expo-observe', () => ({ useObserve: () => ({ markInteractive: jest.fn() }) }));
jest.mock('@/features/auth/session-provider', () => ({ useSession: () => mockSessionState }));
jest.mock('@/lib/db/client', () => ({
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
}));
jest.mock('@/lib/off-dump/off-dump', () => ({
  initOffDump: (...args: unknown[]) => mockInitOffDump(...args),
}));
jest.mock('@/lib/config/env', () => ({
  env: {
    get forceOnboarding() {
      return mockForceOnboarding;
    },
    get devTools() {
      return mockDevTools;
    },
  },
}));

const privateRootRoutes = [
  'household',
  'profile',
  'recipe',
  'settings',
  'gamification',
  'add-item',
  'add-product',
  'add-food-entry',
];

describe('RootNavigator', () => {
  beforeEach(() => {
    mockDevTools = false;
    mockForceOnboarding = false;
    mockPathname = '/';
  });

  it('zeigt neuen Nutzern das Onboarding und noch keine Auth-Routen', async () => {
    mockDevTools = false;
    mockSessionState = {
      session: null,
      accountReady: true,
      isLoading: false,
      seenOnboarding: false,
    };

    await render(<RootNavigator />);

    expect(screen.getByText('onboarding')).toBeOnTheScreen();
    expect(screen.queryByText('(auth)')).not.toBeOnTheScreen();
  });

  it('registriert private Root-Routen ausschließlich mit einer Session', async () => {
    jest.clearAllMocks();
    mockDevTools = false;
    mockSessionState = {
      session: null,
      accountReady: true,
      isLoading: false,
      seenOnboarding: true,
    };
    const view = await render(<RootNavigator />);

    expect(mockGetDatabase).not.toHaveBeenCalled();

    for (const route of privateRootRoutes) {
      expect(screen.queryByText(route)).not.toBeOnTheScreen();
    }
    expect(screen.queryByText('onboarding')).not.toBeOnTheScreen();
    expect(screen.getByText('(auth)')).toBeOnTheScreen();

    mockSessionState = {
      session: { user: { id: 'user-1' } },
      accountReady: true,
      isLoading: false,
      seenOnboarding: true,
    };
    await view.rerender(<RootNavigator />);

    expect(mockGetDatabase).toHaveBeenCalledTimes(1);

    for (const route of privateRootRoutes) {
      expect(screen.getByText(route)).toBeOnTheScreen();
    }
    expect(screen.getByText('onboarding')).toBeOnTheScreen();
    expect(screen.queryByText('meal-planner')).not.toBeOnTheScreen();
    expect(screen.queryByText('(auth)')).not.toBeOnTheScreen();
  });

  it('priorisiert das erzwungene Onboarding vor dem gespeicherten Login-Zustand', async () => {
    mockForceOnboarding = true;
    mockSessionState = {
      session: null,
      accountReady: true,
      isLoading: false,
      seenOnboarding: true,
    };

    await render(<RootNavigator />);

    expect(screen.getByText('redirect:/onboarding')).toBeOnTheScreen();
    expect(screen.queryByText('(auth)')).not.toBeOnTheScreen();
  });

  it('stellt Auth-Routen für die Dev-Tools auch mit Session bereit', async () => {
    mockDevTools = true;
    mockSessionState = {
      session: { user: { id: 'user-1' } },
      accountReady: true,
      isLoading: false,
      seenOnboarding: true,
    };

    await render(<RootNavigator />);

    expect(screen.getByText('(auth)')).toBeOnTheScreen();
  });

  it('zeigt bei einem Session-Bootstrap-Fehler den wiederholbaren Fallback', async () => {
    mockSessionState = {
      session: { user: { id: 'user-1' } },
      accountReady: false,
      isLoading: false,
      seenOnboarding: true,
      error: new Error('lokaler Bootstrap fehlgeschlagen'),
      retry: jest.fn(),
    };

    await render(<RootNavigator />);

    expect(screen.getByText('Etwas ist schiefgelaufen')).toBeOnTheScreen();
    expect(screen.queryByText('household')).not.toBeOnTheScreen();
  });

  it('startet DB und OFF erst, wenn der Session-Bootstrap-Fehler verschwunden ist', async () => {
    jest.clearAllMocks();
    mockDevTools = false;
    mockSessionState = {
      session: { user: { id: 'user-1' } },
      accountReady: false,
      isLoading: false,
      seenOnboarding: true,
      error: new Error('lokaler Bootstrap fehlgeschlagen'),
    };

    const view = await render(<RootNavigator />);

    expect(mockGetDatabase).not.toHaveBeenCalled();
    expect(mockInitOffDump).not.toHaveBeenCalled();

    mockSessionState = {
      session: { user: { id: 'user-1' } },
      accountReady: true,
      isLoading: false,
      seenOnboarding: true,
      error: null,
    };
    await view.rerender(<RootNavigator />);

    expect(mockGetDatabase).toHaveBeenCalledTimes(1);
    expect(mockInitOffDump).toHaveBeenCalledTimes(1);
  });

  it('startet DB und OFF nicht während eines laufenden Session-Retries', async () => {
    jest.clearAllMocks();
    mockDevTools = false;
    mockSessionState = {
      session: { user: { id: 'user-1' } },
      accountReady: false,
      isLoading: true,
      seenOnboarding: true,
      error: null,
    };

    const view = await render(<RootNavigator />);

    expect(mockGetDatabase).not.toHaveBeenCalled();
    expect(mockInitOffDump).not.toHaveBeenCalled();

    mockSessionState = {
      session: { user: { id: 'user-1' } },
      accountReady: true,
      isLoading: false,
      seenOnboarding: true,
      error: null,
    };
    await view.rerender(<RootNavigator />);

    expect(mockGetDatabase).toHaveBeenCalledTimes(1);
    expect(mockInitOffDump).toHaveBeenCalledTimes(1);
  });
});
