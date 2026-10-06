import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colorsLight } from '@/components/theme';

import { ProfileSheet } from '@/features/navigation/profile-sheet';
import { ProfileSheet as AndroidProfileSheet } from '@/features/navigation/profile-sheet.android';

const mockPush = jest.fn();
const mockCloseProfile = jest.fn();
const profileSheetVariants: Array<{
  platform: string;
  Component: typeof ProfileSheet;
}> = [
  { platform: 'iOS', Component: ProfileSheet },
  { platform: 'Android', Component: AndroidProfileSheet },
];

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

jest.mock('@/features/profile/api', () => ({
  useProfile: () => ({
    data: { display_name: 'Max Mustermann', avatar_url: null },
  }),
}));

jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => ({ hasPlus: true }),
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
    expect(screen.getByText('Plus & KI')).toBeTruthy();
  });

  it.each(profileSheetVariants)(
    '$platform verwendet die gemeinsame Scrim-Rolle',
    async ({ Component }) => {
      await render(
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 390, height: 844 },
            insets: { top: 47, left: 0, right: 0, bottom: 34 },
          }}>
          <Component />
        </SafeAreaProvider>,
      );

      const backdrop = screen.getAllByLabelText('Profil schließen')[0];

      expect(backdrop.props.style).toContainEqual(
        expect.objectContaining({ backgroundColor: colorsLight.scrim }),
      );
    },
  );

  it.each(profileSheetVariants)('$platform schliesst beim Aussentap', async ({ Component }) => {
    const user = userEvent.setup();

    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <Component />
      </SafeAreaProvider>,
    );

    await user.press(screen.getAllByRole('button', { name: 'Profil schließen' })[0]);

    expect(mockCloseProfile).toHaveBeenCalledTimes(1);
  });

  it.each(profileSheetVariants)('$platform schliesst bei System-Zurueck', async ({ Component }) => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <Component />
      </SafeAreaProvider>,
    );

    await fireEvent(screen.getAllByRole('button', { name: 'Profil schließen' })[0], 'requestClose');

    expect(mockCloseProfile).toHaveBeenCalledTimes(1);
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

  it('öffnet das Profil direkt beim Klick auf Mein Profil', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ProfileSheet />
      </SafeAreaProvider>,
    );

    await fireEvent.press(screen.getByText('Mein Profil'));

    expect(mockPush).toHaveBeenCalledWith('/profile/edit');
  });
});
