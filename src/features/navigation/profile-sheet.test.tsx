import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ProfileSheet } from '@/features/navigation/profile-sheet';

const mockPush = jest.fn();
const mockCloseProfile = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('./navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({
    isProfileOpen: true,
    closeProfile: mockCloseProfile,
  }),
}));

jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({
    isProfileOpen: true,
    closeProfile: mockCloseProfile,
  }),
}));

jest.mock('@/hooks/use-deferred-mount', () => ({
  useDeferredMount: () => true,
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({
    session: { user: { id: 'user-1', email: 'test@fam.app' } },
  }),
}));

jest.mock('@/features/auth/api', () => ({
  useProfile: () => ({
    data: { display_name: 'Max Mustermann', avatar_url: null },
  }),
}));

jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => ({ isPremium: true }),
}));

describe('ProfileSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rendert Benutzername und Profiloptionen', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ProfileSheet />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('Max Mustermann')).toBeTruthy();
    expect(screen.getByText('Mein Profil')).toBeTruthy();
    expect(screen.getByText('Familie')).toBeTruthy();
    expect(screen.getByText('Premium')).toBeTruthy();
  });

  it('navigiert zu Haushalts-Einstellungen beim Klick auf Familie', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ProfileSheet />
      </SafeAreaProvider>,
    );

    const hhBtn = screen.getByText('Familie');
    await fireEvent.press(hhBtn);

    expect(mockPush).toHaveBeenCalledWith('/household/members');
  });
});
