import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent } from '@testing-library/react-native';

import { updateProfile, useProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-provider';
import { EditProfileScreen } from '@/features/profile/edit-profile-screen';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: jest.fn(),
}));

jest.mock('@/features/auth/api', () => ({
  useProfile: jest.fn(),
  updateProfile: jest.fn().mockResolvedValue({ error: null }),
  updatePassword: jest.fn().mockResolvedValue({ error: null }),
}));

jest.mock('@/features/profile/avatar-uploader', () => ({
  pickAvatarImage: jest.fn().mockResolvedValue('file:///local/image.jpg'),
  uploadAvatarImage: jest.fn().mockResolvedValue('https://example.com/avatar.jpg'),
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
    },
    isLoading: false,
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <EditProfileScreen />
    </QueryClientProvider>,
  );
}

describe('EditProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rendert Profilbild-Bereich mit Bild auswählen Button und Initialen', async () => {
    await renderScreen(null);

    expect(screen.getByText('MM')).toBeOnTheScreen();
    expect(screen.getByText('Bild auswählen')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('Max Mustermann')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('max@example.com')).toBeOnTheScreen();
  });

  it('zeigt Bild entfernen an wenn ein avatar_url vorhanden ist', async () => {
    await renderScreen('https://example.com/avatar.jpg');

    expect(screen.getByText('Bild ändern')).toBeOnTheScreen();
    expect(screen.getByText('Bild entfernen')).toBeOnTheScreen();
  });

  it('loescht das Profilbild beim Klick auf Bild entfernen', async () => {
    const user = userEvent.setup();
    await renderScreen('https://example.com/avatar.jpg');

    const deleteBtn = screen.getByText('Bild entfernen');
    await user.press(deleteBtn);

    expect(updateProfile).toHaveBeenCalledWith('user-1', { avatarUrl: null });
  });
});
