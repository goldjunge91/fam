import { PostgrestError } from '@supabase/postgrest-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { updatePassword } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-provider';
import { updateProfile, useProfile } from '@/features/profile/api';
import { EditProfileScreen } from '@/features/profile/edit-profile-screen';
import { EditProfileScreen as EditProfileScreenAndroid } from '@/features/profile/edit-profile-screen.android';
import { saveProfileFoodRules, useProfileFoodRules } from '@/features/profile/food-rules-api';
import { i18n } from '@/i18n';

const mockRemoveAvatar = jest.fn().mockResolvedValue({ error: null });
const mockAuthUpdateUser = jest.fn().mockResolvedValue({ error: null });
const mockPickAvatarImage = jest.fn().mockResolvedValue('file:///local/image.jpg');
const mockUploadAvatarImage = jest.fn().mockResolvedValue('https://example.com/avatar.jpg');
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

jest.mock('@/features/profile/api', () => ({
  useProfile: jest.fn(),
  updateProfile: jest.fn().mockResolvedValue({ error: null }),
}));

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: () => ({
    auth: { updateUser: (...args: unknown[]) => mockAuthUpdateUser(...args) },
    storage: { from: () => ({ remove: mockRemoveAvatar }) },
  }),
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
  pickAvatarImage: (...args: unknown[]) => mockPickAvatarImage(...args),
  uploadAvatarImage: (...args: unknown[]) => mockUploadAvatarImage(...args),
}));

async function renderScreen(
  avatarUrl: string | null = null,
  Screen: typeof EditProfileScreen = EditProfileScreen,
  session: { user: { id: string; email: string } } | null = {
    user: { id: 'user-1', email: 'max@example.com' },
  },
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  });

  (useSession as jest.Mock).mockReturnValue({
    session,
  });

  (useProfile as jest.Mock).mockReturnValue({
    data: {
      id: 'user-1',
      display_name: 'Max Mustermann',
      avatar_url: avatarUrl,
      birth_date: '1990-01-01',
      height_cm: 180,
      weight_kg: 80,
      sex: 'male',
      activity_level: 'moderate',
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
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <QueryClientProvider client={queryClient}>
        <Screen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe('EditProfileScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockRemoveAvatar.mockResolvedValue({ error: null });
    mockAuthUpdateUser.mockResolvedValue({ error: null });
    mockPickAvatarImage.mockResolvedValue('file:///local/image.jpg');
    mockUploadAvatarImage.mockResolvedValue('https://example.com/avatar.jpg');
    jest.mocked(updateProfile).mockResolvedValue({ error: null });
    jest.mocked(updatePassword).mockResolvedValue({ error: null });
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
    expect(screen.getByText('Profilgewicht')).toBeOnTheScreen();
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
        weightKg: 80,
        sex: 'male',
        activityLevel: 'moderate',
      }),
    );
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
    await user.press(screen.getByRole('togglebutton', { name: 'Neues Passwort anzeigen' }));
    expect(passwordInput).toHaveProp('secureTextEntry', false);
    expect(
      screen.getByRole('togglebutton', { name: 'Neues Passwort verbergen' }),
    ).toBeOnTheScreen();
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
    expect(mockRemoveAvatar).toHaveBeenCalledWith(['user-1/avatar.jpg']);
  });
});

describe('EditProfileScreen Android', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockRemoveAvatar.mockResolvedValue({ error: null });
    mockAuthUpdateUser.mockResolvedValue({ error: null });
    mockPickAvatarImage.mockResolvedValue('file:///local/image.jpg');
    mockUploadAvatarImage.mockResolvedValue('https://example.com/avatar.jpg');
    jest.mocked(updateProfile).mockResolvedValue({ error: null });
    jest.mocked(updatePassword).mockResolvedValue({ error: null });
    mockCaloriesTrackingEnabled = true;
    await i18n.changeLanguage('de');
  });

  it('rendert Profil- und Körperdaten nach dem Laden', async () => {
    await renderScreen(null, EditProfileScreenAndroid);

    expect(screen.getByText('MM')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Allergien bearbeiten/ })).toBeOnTheScreen();
    expect(screen.getByText('80 kg')).toBeOnTheScreen();
    expect(screen.getByText('180 cm')).toBeOnTheScreen();
  });

  it('speichert Profil- und Lebensmittelregeln über die Android-Ansicht', async () => {
    const user = userEvent.setup();
    await renderScreen(null, EditProfileScreenAndroid);

    await user.press(screen.getByRole('button', { name: 'Änderungen speichern' }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('user-1', {
        displayName: 'Max Mustermann',
        avatarUrl: null,
        birthDate: '1990-01-01',
        heightCm: 180,
        weightKg: 80,
        sex: 'male',
        activityLevel: 'moderate',
      }),
    );
    expect(saveProfileFoodRules).toHaveBeenCalledWith('user-1', {
      allergies: [{ source: 'preset', code: 'peanuts' }],
      intolerances: [{ source: 'preset', code: 'lactose' }],
      dislikedFoods: [{ source: 'custom', label: 'Oliven', normalizedLabel: 'oliven' }],
    });
  });

  it('speichert ein neues Passwort aus dem Android-Passwort-Sheet', async () => {
    const user = userEvent.setup();
    await renderScreen(null, EditProfileScreenAndroid);

    await user.press(screen.getByRole('button', { name: 'Passwort ändern' }));
    await user.paste(screen.getByLabelText('Neues Passwort'), 'sicheres-passwort');
    await user.paste(screen.getByLabelText('Neues Passwort bestätigen'), 'sicheres-passwort');
    await user.press(screen.getByRole('button', { name: 'Passwort speichern' }));

    await waitFor(() => expect(updatePassword).toHaveBeenCalledWith('sicheres-passwort'));
  });
});

describe.each([
  ['iOS', EditProfileScreen],
  ['Android', EditProfileScreenAndroid],
] as const)('EditProfileScreen %s behavior', (_platform, Screen) => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockRemoveAvatar.mockResolvedValue({ error: null });
    mockAuthUpdateUser.mockResolvedValue({ error: null });
    mockPickAvatarImage.mockResolvedValue('file:///local/image.jpg');
    mockUploadAvatarImage.mockResolvedValue('https://example.com/avatar.jpg');
    jest.mocked(updateProfile).mockResolvedValue({ error: null });
    jest.mocked(updatePassword).mockResolvedValue({ error: null });
    mockCaloriesTrackingEnabled = true;
    await i18n.changeLanguage('de');
  });

  afterEach(() => jest.restoreAllMocks());

  it('uploads a selected avatar and reports a picker cancellation and upload failure', async () => {
    const user = userEvent.setup();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockPickAvatarImage.mockResolvedValueOnce(null);
    await renderScreen(null, Screen);

    await user.press(screen.getByRole('button', { name: 'Bild auswählen' }));
    expect(mockUploadAvatarImage).not.toHaveBeenCalled();

    mockPickAvatarImage.mockResolvedValueOnce('file:///local/image.jpg');
    mockUploadAvatarImage.mockRejectedValueOnce(new Error('upload failed'));
    await user.press(screen.getByRole('button', { name: 'Bild auswählen' }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Fehler', 'upload failed'));

    mockUploadAvatarImage.mockResolvedValue('https://example.com/avatar.jpg');
    await user.press(screen.getByRole('button', { name: 'Bild auswählen' }));
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('user-1', {
        avatarUrl: 'https://example.com/avatar.jpg',
      }),
    );
    expect(mockPickAvatarImage).toHaveBeenCalledTimes(3);
  });

  it('reports avatar write failures and removes an existing avatar', async () => {
    const user = userEvent.setup();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.mocked(updateProfile).mockRejectedValueOnce(new Error('avatar write failed'));
    await renderScreen('https://example.com/avatar.jpg', Screen);

    await user.press(screen.getByRole('button', { name: 'Bild ändern' }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Fehler', 'avatar write failed'));

    await user.press(screen.getByText('Bild entfernen'));
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith('user-1', { avatarUrl: null }));
    expect(await screen.findByRole('button', { name: 'Bild auswählen' })).toBeOnTheScreen();
  });

  it('saves a changed email and reports profile update errors', async () => {
    const user = userEvent.setup();
    await renderScreen(null, Screen);

    await user.clear(screen.getByLabelText('E-Mail-Adresse'));
    await user.type(screen.getByLabelText('E-Mail-Adresse'), 'neu@example.com');
    await user.press(screen.getByRole('button', { name: 'Änderungen speichern' }));
    await waitFor(() =>
      expect(mockAuthUpdateUser).toHaveBeenCalledWith({ email: 'neu@example.com' }),
    );

    jest.mocked(updateProfile).mockResolvedValueOnce({
      error: new PostgrestError({
        code: 'XX000',
        details: '',
        hint: '',
        message: 'Profil kann nicht gespeichert werden',
      }),
    });
    await user.press(screen.getByRole('button', { name: 'Änderungen speichern' }));
    expect(await screen.findByText('Profil kann nicht gespeichert werden')).toBeOnTheScreen();
  });

  it('applies edited biometrics and food rules to the private profile writes', async () => {
    const user = userEvent.setup();
    await renderScreen(null, Screen);

    await user.press(screen.getByRole('button', { name: /Körper & Aktivität bearbeiten/ }));
    await user.clear(screen.getByLabelText('Körpergröße (cm)'));
    await user.type(screen.getByLabelText('Körpergröße (cm)'), '177');
    await user.press(screen.getByRole('button', { name: 'Angaben übernehmen' }));

    await user.press(screen.getByRole('button', { name: /Allergien bearbeiten/ }));
    await user.press(screen.getByRole('checkbox', { name: 'Erdnüsse' }));
    await user.press(screen.getByRole('button', { name: 'Auswahl übernehmen' }));
    await user.press(screen.getByRole('button', { name: 'Änderungen speichern' }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ heightCm: 177 }),
      ),
    );
    expect(saveProfileFoodRules).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ allergies: [] }),
    );
  });

  it('does not open the native image picker when the account is signed out', async () => {
    const user = userEvent.setup();
    await renderScreen(null, Screen, null);

    await user.press(screen.getByRole('button', { name: 'Bild auswählen' }));
    expect(mockPickAvatarImage).not.toHaveBeenCalled();
    expect(updateProfile).not.toHaveBeenCalled();
  });
});
