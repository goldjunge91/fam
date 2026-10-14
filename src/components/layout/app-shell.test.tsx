import { render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import AppShell from './app-shell';

type FloatingActionButtonProps = {
  label: string;
  onPress: () => void;
  children: ReactNode;
};

let mockPathname = '/inventory';
let mockSessionUserId: string | null = 'viewer';
let mockQuickAddOpen = false;
let mockFabPosition: 'left' | 'right' | undefined;
const mockToggleQuickAdd = jest.fn();

jest.mock('expo-router', () => ({
  Stack: () => null,
  usePathname: () => mockPathname,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
}));
jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: { onAccent: '#FFFFFF' } }),
}));
jest.mock('@/components/ui/sync-status-banner', () => ({
  SyncBannerVisibilityProvider: ({ children }: { children: ReactNode }) => children,
  SyncStatusBanner: () => null,
}));
jest.mock('@/components/ui/floating-action-button', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    FloatingActionButton: ({ label, onPress, children }: FloatingActionButtonProps) =>
      React.createElement(
        Pressable,
        { accessibilityRole: 'button', accessibilityLabel: label, onPress },
        children,
      ),
  };
});
jest.mock('@/features/ads', () => ({
  AdBanner: () => {
    const { View } = jest.requireActual<typeof import('react-native')>('react-native');
    return <View testID="sticky-ad" />;
  },
}));
jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockSessionUserId ? { user: { id: mockSessionUserId } } : null }),
}));
jest.mock('@/features/navigation/fab-position-settings', () => ({
  DEFAULT_FAB_POSITION: 'right',
  useFabPosition: () => ({ data: mockFabPosition }),
}));
jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({
    isQuickAddOpen: mockQuickAddOpen,
    toggleQuickAdd: mockToggleQuickAdd,
  }),
}));
jest.mock('@/features/navigation/navigation-drawer', () => ({ NavigationDrawer: () => null }));
jest.mock('@/features/navigation/speed-dial-menu', () => ({ SpeedDialMenu: () => null }));
jest.mock('@/components/icons/fam-icon', () => ({ PlusIcon: () => null }));

describe('AppShell', () => {
  beforeEach(() => {
    mockPathname = '/inventory';
    mockSessionUserId = 'viewer';
    mockQuickAddOpen = false;
    mockFabPosition = undefined;
    mockToggleQuickAdd.mockClear();
  });

  it('shows the global add action and sticky banner outside brochure routes', async () => {
    const user = userEvent.setup();
    await render(<AppShell />);

    expect(screen.getByTestId('sticky-ad')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Neu hinzufügen' }));
    expect(mockToggleQuickAdd).toHaveBeenCalledTimes(1);
  });

  it('uses the open-menu label and supports the left FAB position', async () => {
    const user = userEvent.setup();
    mockQuickAddOpen = true;
    mockFabPosition = 'left';
    await render(<AppShell />);

    await user.press(screen.getByRole('button', { name: 'Menü schließen' }));
    expect(mockToggleQuickAdd).toHaveBeenCalledTimes(1);
  });

  it('hides global overlays on the brochure overview and detail routes', async () => {
    mockPathname = '/brochures';
    await render(<AppShell />);
    expect(screen.queryByTestId('sticky-ad')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Neu hinzufügen' })).not.toBeOnTheScreen();

    mockPathname = '/brochures/weekly';
    await render(<AppShell />);
    expect(screen.queryByTestId('sticky-ad')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Neu hinzufügen' })).not.toBeOnTheScreen();
  });
});
