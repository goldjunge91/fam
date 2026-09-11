import { render, screen, userEvent } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { HubScreen } from '@/components/layout/hub-screen';

const mockOpenProfile = jest.fn();

jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({ openProfile: mockOpenProfile }),
}));
jest.mock('@/features/navigation/use-profile-initials', () => ({
  useProfileAvatar: () => ({ initials: 'MM', avatarUrl: null }),
}));
jest.mock('@/hooks/use-hub-gradient', () => ({
  useHubGradient: () => ({ colors: ['#fff', '#fff'] }),
}));
jest.mock('@/components/ui/sync-status-banner', () => ({
  useSyncBannerVisible: () => false,
}));

describe('HubScreen', () => {
  it('behält rechte Header-Aktionen und öffnet über den Avatar das Profilmenü', async () => {
    const user = userEvent.setup();

    await render(
      <HubScreen
        header={{
          title: 'Essensplan',
          trailing: (
            <Pressable accessibilityRole="button" accessibilityLabel="Aktuelle Woche anzeigen">
              <Text>Kalender</Text>
            </Pressable>
          ),
        }}>
        <Text>Inhalt</Text>
      </HubScreen>,
    );

    expect(screen.getByRole('button', { name: 'Aktuelle Woche anzeigen' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Profil öffnen' }));

    expect(mockOpenProfile).toHaveBeenCalledTimes(1);
  });
});
