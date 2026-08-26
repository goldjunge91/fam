import { render, screen } from '@testing-library/react-native';
import type { PropsWithChildren, ReactNode } from 'react';

import { RootNavigator } from './root-navigator';

let mockSessionState: {
  session: { user: { id: string } } | null;
  isLoading: boolean;
  seenOnboarding: boolean;
};

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const Stack = Object.assign(({ children }: PropsWithChildren) => children, {
    Screen: ({ name }: { name: string }) => React.createElement(Text, null, name),
    Protected: ({ children, guard }: { children: ReactNode; guard: boolean }) =>
      guard ? children : null,
  });

  return { Stack };
});
jest.mock('expo-observe', () => ({ useObserve: () => ({ markInteractive: jest.fn() }) }));
jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn() }));
jest.mock('@/features/auth/session-provider', () => ({ useSession: () => mockSessionState }));
jest.mock('@/lib/db/client', () => ({ getDatabase: () => Promise.resolve({}) }));
jest.mock('@/lib/off-dump/off-dump', () => ({ initOffDump: jest.fn() }));
jest.mock('@/lib/env', () => ({ env: { forceOnboarding: false } }));

const privateRootRoutes = [
  'household',
  'profile',
  'recipe',
  'settings',
  'meal-planner',
  'add-item',
  'add-product',
  'food-search',
  'add-food-entry',
];

describe('RootNavigator', () => {
  it('registriert private Root-Routen ausschließlich mit einer Session', async () => {
    mockSessionState = { session: null, isLoading: false, seenOnboarding: true };
    const view = await render(<RootNavigator />);

    for (const route of privateRootRoutes) {
      expect(screen.queryByText(route)).not.toBeOnTheScreen();
    }

    mockSessionState = {
      session: { user: { id: 'user-1' } },
      isLoading: false,
      seenOnboarding: true,
    };
    await view.rerender(<RootNavigator />);

    for (const route of privateRootRoutes) {
      expect(screen.getByText(route)).toBeOnTheScreen();
    }
  });
});
