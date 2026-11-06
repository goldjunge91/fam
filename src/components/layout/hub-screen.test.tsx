import { render, screen, userEvent } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { HubScreen } from '@/components/layout/hub-screen';

const mockOpenProfile = jest.fn();
let mockBannerVisible = false;

jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({ openProfile: mockOpenProfile }),
}));
jest.mock('@/features/navigation/use-profile-initials', () => ({
  useProfileAvatar: () => ({ initials: 'MM', avatarUrl: null }),
}));
jest.mock('@/components/ui/sync-status-banner', () => ({
  useSyncBannerVisible: () => mockBannerVisible,
}));

describe('HubScreen', () => {
  beforeEach(() => {
    mockBannerVisible = false;
    mockOpenProfile.mockClear();
  });

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

  it('behält den vollständigen langen Hub-Titel zugänglich und den Profilbutton verfügbar', async () => {
    const title = 'Ein außergewöhnlich langer dynamischer Bereichstitel';

    await render(
      <HubScreen header={{ title }}>
        <Text>Inhalt</Text>
      </HubScreen>,
    );

    expect(screen.getByLabelText(title)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Profil öffnen' })).toBeOnTheScreen();
  });

  it('keeps the top safe area for the visible sync banner', async () => {
    mockBannerVisible = true;

    await render(
      <HubScreen header={{ title: 'Essensplan' }}>
        <Text>Planinhalt</Text>
      </HubScreen>,
    );

    expect(screen.getByText('Planinhalt')).toBeOnTheScreen();
  });
});
