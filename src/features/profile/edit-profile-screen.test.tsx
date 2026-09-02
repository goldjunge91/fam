import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { updatePassword } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-provider';
import { updateProfile, useProfile } from '@/features/profile/api';
import { EditProfileScreen } from '@/features/profile/edit-profile-screen';
import { saveProfileFoodRules, useProfileFoodRules } from '@/features/profile/food-rules-api';

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
  updatePassword: jest.fn().mockResolvedValue({ error: null }),
}));

jest.mock('@/features/profile/api', () => ({
  useProfile: jest.fn(),
  updateProfile: jest.fn().mockResolvedValue({ error: null }),
}));

jest.mock('@/features/profile/food-rules-api', () => ({
  profileFoodRulesQueryKey: (userId: string | undefined) => ['profile-food-rules', userId],
  useProfileFoodRules: jest.fn(),
  saveProfileFoodRules: jest.fn().mockResolvedValue(undefined),
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

  (useProfileFoodRules as jest.Mock).mockReturnValue({
    data: {
      allergies: [{ source: 'preset', code: 'peanuts' }],
      intolerances: [{ source: 'preset', code: 'lactose' }],
      dislikedFoods: [{ source: 'custom', label: 'Oliven', normalizedLabel: 'oliven' }],
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

  it('zeigt Allergien, Unverträglichkeiten und Mag ich nicht im Profil', async () => {
    await renderScreen();

    expect(screen.getByRole('button', { name: /Allergien bearbeiten/ })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: /Unverträglichkeiten bearbeiten/ }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Mag ich nicht bearbeiten/ })).toBeOnTheScreen();
  });

  it('speichert die accountweiten Lebensmittelregeln über den vorhandenen Profil-Button', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByRole('button', { name: 'Änderungen speichern' }));

    await waitFor(() =>
      expect(saveProfileFoodRules).toHaveBeenCalledWith('user-1', {
        allergies: [{ source: 'preset', code: 'peanuts' }],
        intolerances: [{ source: 'preset', code: 'lactose' }],
        dislikedFoods: [{ source: 'custom', label: 'Oliven', normalizedLabel: 'oliven' }],
      }),
    );
  });

  it('speichert ein neues Passwort direkt im Passwort-Sheet', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByRole('button', { name: 'Passwort ändern' }));
    await user.paste(screen.getByLabelText('Neues Passwort'), 'sicheres-passwort');
    await user.paste(screen.getByLabelText('Neues Passwort bestätigen'), 'sicheres-passwort');
    await user.press(screen.getByRole('button', { name: 'Passwort speichern' }));

    await waitFor(() => expect(updatePassword).toHaveBeenCalledWith('sicheres-passwort'));
  });

  it('kann die Sichtbarkeit des neuen Passworts umschalten', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByRole('button', { name: 'Passwort ändern' }));
    const passwordInput = screen.getByLabelText('Neues Passwort');

    expect(passwordInput).toHaveProp('secureTextEntry', true);
    await user.press(screen.getByRole('button', { name: 'Neues Passwort anzeigen' }));
    expect(passwordInput).toHaveProp('secureTextEntry', false);
    expect(screen.getByRole('button', { name: 'Neues Passwort verbergen' })).toBeOnTheScreen();
  });

  it('zeigt Bild entfernen an wenn ein avatar_url vorhanden ist', async () => {
    await renderScreen('https://example.com/avatar.jpg');

    expect(screen.getByText('Bild ändern')).toBeOnTheScreen();
    expect(screen.getByText('Bild entfernen')).toBeOnTheScreen();
    expect(screen.getByLabelText('Profilbild bearbeiten')).toHaveStyle({
      width: '100%',
      height: '100%',
    });
  });

  it('loescht das Profilbild beim Klick auf Bild entfernen', async () => {
    const user = userEvent.setup();
    await renderScreen('https://example.com/avatar.jpg');

    const deleteBtn = screen.getByText('Bild entfernen');
    await user.press(deleteBtn);

    expect(updateProfile).toHaveBeenCalledWith('user-1', { avatarUrl: null });
  });
});
