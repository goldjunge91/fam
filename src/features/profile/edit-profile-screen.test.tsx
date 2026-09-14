import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { updatePassword } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-provider';
import { useAddWeightEntryMutation } from '@/features/calorie-tracking/api';
import { updateProfile, useProfile } from '@/features/profile/api';
import { useLatestProfileWeight } from '@/features/profile/biometrics-api';
import { EditProfileScreen } from '@/features/profile/edit-profile-screen';
import { saveProfileFoodRules, useProfileFoodRules } from '@/features/profile/food-rules-api';
import { i18n } from '@/i18n';

const mockAddWeight = jest.fn().mockResolvedValue(null);
let mockCaloriesTrackingEnabled = true;

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

jest.mock('@/features/calorie-tracking/api', () => ({
  useAddWeightEntryMutation: jest.fn(),
}));

jest.mock('@/features/profile/api', () => ({
  useProfile: jest.fn(),
  updateProfile: jest.fn().mockResolvedValue({ error: null }),
}));

jest.mock('@/features/profile/biometrics-api', () => ({
  profileLatestWeightQueryKey: (userId: string | undefined) => ['profile', 'latest-weight', userId],
  useLatestProfileWeight: jest.fn(),
}));

jest.mock('@/features/profile/food-rules-api', () => ({
  profileFoodRulesQueryKey: (userId: string | undefined) => ['profile-food-rules', userId],
  useProfileFoodRules: jest.fn(),
  saveProfileFoodRules: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/settings/use-feature-access', () => ({
  useFeatureAccess: () => ({
    isFeatureEnabled: () => mockCaloriesTrackingEnabled,
  }),
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
      birth_date: '1990-01-01',
      height_cm: 180,
      sex: 'male',
      activity_level: 'moderate',
    },
    isLoading: false,
  });

  (useLatestProfileWeight as jest.Mock).mockReturnValue({
    data: { weight_kg: 80 },
    isLoading: false,
  });

  (useAddWeightEntryMutation as jest.Mock).mockReturnValue({
    mutateAsync: mockAddWeight,
    isPending: false,
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
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <QueryClientProvider client={queryClient}>
        <EditProfileScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe('EditProfileScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockCaloriesTrackingEnabled = true;
    await i18n.changeLanguage('de');
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

  it('zeigt die Onboarding-Körperdaten als eigene Card im Profil', async () => {
    await renderScreen();

    expect(screen.getByRole('button', { name: /Körper & Aktivität bearbeiten/ })).toBeOnTheScreen();
    expect(screen.getByText('Aktuelles Gewicht')).toBeOnTheScreen();
    expect(screen.getByText('80 kg')).toBeOnTheScreen();
    expect(screen.getByText('180 cm')).toBeOnTheScreen();
    expect(screen.getByText('01.01.1990')).toBeOnTheScreen();
    expect(screen.getByText('Mäßig aktiv')).toBeOnTheScreen();
  });

  it('blendet die Körper-&-Aktivität-Card ohne aktiviertes Kalorien-Tracking aus', async () => {
    mockCaloriesTrackingEnabled = false;

    await renderScreen();

    expect(screen.queryByText('Körper & Aktivität')).not.toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: /Körper & Aktivität bearbeiten/ }),
    ).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Allergien bearbeiten/ })).toBeOnTheScreen();
  });

  it('speichert die Körperdaten über die bestehenden privaten Profilpfade', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByRole('button', { name: 'Änderungen speichern' }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('user-1', {
        displayName: 'Max Mustermann',
        avatarUrl: null,
        birthDate: '1990-01-01',
        heightCm: 180,
        sex: 'male',
        activityLevel: 'moderate',
      }),
    );
    expect(mockAddWeight).not.toHaveBeenCalled();
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
    expect(screen.getByTestId('profile-avatar')).toHaveStyle({
      width: 80,
      height: 80,
    });
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
