import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useSession } from '@/features/auth/session-provider';
import { useProfile } from '@/features/profile/api';
import { ProfileHubScreen } from '@/features/profile/profile-hub-screen';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: jest.fn(),
}));

jest.mock('@/features/profile/api', () => ({
  useProfile: jest.fn(),
}));

async function renderScreen(avatarUrl: string | null = null) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  });

  (useSession as jest.Mock).mockReturnValue({
    session: {
      user: { id: 'user-1', email: 'max@example.com' },
    },
  });

  (useProfile as jest.Mock).mockReturnValue({
    data: {
      id: 'user-1',
      display_name: 'Max Mustermann',
      avatar_url: avatarUrl,
      tracking_method: 'standard',
    },
    isLoading: false,
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileHubScreen />
    </QueryClientProvider>,
  );
}

describe('ProfileHubScreen (Vorseite)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rendert Profilkopf mit Name, Email und Initialen', async () => {
    await renderScreen();

    expect(screen.getByText('Max Mustermann')).toBeOnTheScreen();
    expect(screen.getByText('max@example.com')).toBeOnTheScreen();
    expect(screen.getByText('MM')).toBeOnTheScreen();
  });

  it('gibt dem Profilbild eine explizite Groesse', async () => {
    await renderScreen('https://example.com/avatar.jpg');

    expect(screen.getByLabelText('Profilbild im Profil')).toHaveStyle({
      width: '100%',
      height: '100%',
    });
  });

  it('navigiert zu Profil & Account beim Klick auf Profil & Account-Daten', async () => {
    const user = userEvent.setup();
    await renderScreen();

    const accountBtn = screen.getByText('Profil & Account-Daten');
    await user.press(accountBtn);

    expect(router.push).toHaveBeenCalledWith('/profile/edit');
  });

  it('navigiert zu Mein Tracking beim Klick auf Mein Tracking', async () => {
    const user = userEvent.setup();
    await renderScreen();

    const trackingBtn = screen.getByText('Mein Tracking');
    await user.press(trackingBtn);

    expect(router.push).toHaveBeenCalledWith('/profile/tracking');
  });

  it('navigiert zu Haushalt beim Klick auf Familie', async () => {
    const user = userEvent.setup();
    await renderScreen();

    const familyBtn = screen.getByText('Familie');
    await user.press(familyBtn);

    expect(router.push).toHaveBeenCalledWith('/household/members');
  });
});
