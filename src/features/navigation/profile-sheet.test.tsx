import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colorsLight } from '@/components/theme';

import { ProfileSheet } from '@/features/navigation/profile-sheet';
import { ProfileSheet as AndroidProfileSheet } from '@/features/navigation/profile-sheet.android';

const mockPush = jest.fn();
const mockCloseProfile = jest.fn();
let mockProfileData: { display_name?: string | null; avatar_url?: string | null } | null = {
  display_name: 'Max Mustermann',
  avatar_url: null,
};
let mockSession: { user: { id: string; email?: string } } | null = {
  user: { id: 'user-1', email: 'test@fam.app' },
};
let mockPremium: { hasPlus: boolean; hasAI: boolean } = { hasPlus: true, hasAI: false };
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
  useSession: () => ({ session: mockSession }),
}));

jest.mock('@/features/profile/api', () => ({
  useProfile: () => ({ data: mockProfileData }),
}));

jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => mockPremium,
}));

describe('ProfileSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProfileData = { display_name: 'Max Mustermann', avatar_url: null };
    mockSession = { user: { id: 'user-1', email: 'test@fam.app' } };
    mockPremium = { hasPlus: true, hasAI: false };
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

  it.each(profileSheetVariants)(
    '$platform zeigt sinnvolle Werte ohne Profil und Plus-Zugang',
    async ({ Component }) => {
      mockProfileData = null;
      mockSession = null;
      mockPremium = { hasPlus: false, hasAI: false };

      await render(
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 390, height: 844 },
            insets: { top: 47, left: 0, right: 0, bottom: 34 },
          }}>
          <Component />
        </SafeAreaProvider>,
      );

      expect(screen.getByText('Ohne Namen')).toBeTruthy();
      expect(screen.queryByText('test@fam.app')).toBeNull();
      expect(screen.getByText('Jetzt freischalten')).toBeTruthy();
    },
  );

  it.each(profileSheetVariants)(
    '$platform navigiert zu allen Profilbereichen',
    async ({ Component }) => {
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

      for (const [title, href] of [
        ['Mein Profil', '/profile/edit'],
        ['Familie', '/household/members'],
        ['Plus & KI', '/settings/plus-and-ai'],
      ]) {
        await user.press(screen.getByText(title));
        expect(mockPush).toHaveBeenLastCalledWith(href);
      }
    },
  );
});
