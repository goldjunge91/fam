import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { ProfileStepForm } from '@/features/onboarding/components/profile-step-form';

const mockUpdateProfileData = jest.fn();
let mockCaloriesTrackingEnabled = true;
let mockUserProfile: {
  display_name: string | null;
  birth_date: string | null;
  height_cm: number | null;
  sex: string | null;
  activity_level: string | null;
} | null = null;

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/profile/api', () => ({
  useProfile: () => ({ data: mockUserProfile }),
}));

jest.mock('@/features/onboarding/onboarding-store', () => ({
  useOnboarding: () => ({
    state: { profile: {} },
    updateProfileData: mockUpdateProfileData,
  }),
}));

jest.mock('@/features/settings/use-feature-access', () => ({
  useFeatureAccess: () => ({
    isFeatureEnabled: () => mockCaloriesTrackingEnabled,
  }),
}));

jest.mock('@/lib/optionals/RozeniteDevTools', () => ({
  useRozeniteRHFDevTools: jest.fn(),
}));

describe('ProfileStepForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCaloriesTrackingEnabled = true;
    mockUserProfile = null;
  });

  it('zeigt Körper & Aktivität bei aktivem Kalorien-Tracking', async () => {
    await render(<ProfileStepForm onNext={jest.fn()} onSkip={jest.fn()} />);

    expect(screen.getByText('Körper & Aktivität')).toBeOnTheScreen();
    expect(screen.getByLabelText('Geburtsdatum (TT.MM.JJJJ)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Aktivitätslevel im Alltag')).toBeOnTheScreen();
  });

  it('blendet Körper & Aktivität ohne aktiviertes Kalorien-Tracking aus', async () => {
    mockCaloriesTrackingEnabled = false;

    await render(<ProfileStepForm onNext={jest.fn()} onSkip={jest.fn()} />);

    expect(screen.queryByText('Körper & Aktivität')).not.toBeOnTheScreen();
    expect(screen.queryByLabelText('Geburtsdatum (TT.MM.JJJJ)')).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Rufname / Anzeigename')).toBeOnTheScreen();
  });

  it('speichert validierte Profilangaben als normalisierte Werte', async () => {
    const user = userEvent.setup();
    const onNext = jest.fn();

    await render(<ProfileStepForm onNext={onNext} onSkip={jest.fn()} />);
    await user.type(screen.getByLabelText('Rufname / Anzeigename'), '  Marco  ');
    await user.type(screen.getByLabelText('Geburtsdatum (TT.MM.JJJJ)'), '15.05.1990');
    await user.type(screen.getByLabelText('Größe (cm)'), '180');
    await user.type(screen.getByLabelText('Gewicht (kg)'), '80');
    await user.press(screen.getByRole('radio', { name: 'Weiblich' }));
    await user.press(screen.getByRole('radio', { name: 'Gewicht halten' }));
    await user.press(screen.getByRole('radio', { name: 'Sehr aktiv (Täglicher Sport)' }));
    await user.press(screen.getByRole('button', { name: 'Weiter' }));

    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
    expect(mockUpdateProfileData).toHaveBeenCalledWith({
      displayName: 'Marco',
      birthDate: '1990-05-15',
      heightCm: 180,
      weightKg: 80,
      sex: 'female',
      weightGoal: 'maintain',
      activityLevel: 'active',
    });
  });

  it('zeigt Validierungsfehler und verhindert das Speichern ungültiger Angaben', async () => {
    const user = userEvent.setup();
    const onNext = jest.fn();

    await render(<ProfileStepForm onNext={onNext} onSkip={jest.fn()} />);
    await user.type(screen.getByLabelText('Geburtsdatum (TT.MM.JJJJ)'), '31.02.1990');
    await user.type(screen.getByLabelText('Größe (cm)'), '0');
    await user.press(screen.getByRole('button', { name: 'Weiter' }));

    expect(await screen.findByText('Bitte als TT.MM.JJJJ eingeben')).toBeOnTheScreen();
    expect(
      screen.getByText('Bitte eine verlässliche Größe (größer 0, unter 300 cm) eingeben'),
    ).toBeOnTheScreen();
    expect(mockUpdateProfileData).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('füllt fehlende Eingaben mit Profilwerten und bewahrt eine neue eigene Eingabe', async () => {
    const user = userEvent.setup();
    mockUserProfile = {
      display_name: 'Vorname aus Profil',
      birth_date: '1985-06-12',
      height_cm: 172,
      sex: 'male',
      activity_level: 'light',
    };

    await render(<ProfileStepForm onNext={jest.fn()} onSkip={jest.fn()} />);

    expect(screen.getByLabelText('Rufname / Anzeigename')).toHaveDisplayValue('Vorname aus Profil');
    expect(screen.getByLabelText('Geburtsdatum (TT.MM.JJJJ)')).toHaveDisplayValue('12.06.1985');
    expect(screen.getByLabelText('Größe (cm)')).toHaveDisplayValue('172');

    await user.clear(screen.getByLabelText('Rufname / Anzeigename'));
    await user.type(screen.getByLabelText('Rufname / Anzeigename'), 'Eigene Eingabe');
    await user.press(screen.getByRole('button', { name: 'Weiter' }));

    expect(mockUpdateProfileData).toHaveBeenCalledWith({
      displayName: 'Eigene Eingabe',
      birthDate: '1985-06-12',
      heightCm: 172,
      sex: 'male',
      activityLevel: 'light',
      weightKg: undefined,
      weightGoal: undefined,
    });
  });
});
