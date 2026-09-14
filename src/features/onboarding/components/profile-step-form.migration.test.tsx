import { render, screen, userEvent } from '@testing-library/react-native';

import { ProfileStepForm } from '@/features/onboarding/components/profile-step-form';

const mockUpdateProfileData = jest.fn();
let mockCaloriesTrackingEnabled = true;

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/profile/api', () => ({
  useProfile: () => ({ data: null }),
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

describe('ProfileStepForm migration contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCaloriesTrackingEnabled = true;
  });

  it('meldet Auswahlsemantik und aktualisiert die ausgewählte Geschlechtsoption', async () => {
    const user = userEvent.setup();

    await render(<ProfileStepForm onNext={jest.fn()} onSkip={jest.fn()} />);

    const femaleOption = screen.getByRole('radio', { name: 'Weiblich' });
    expect(femaleOption).not.toBeSelected();

    await user.press(femaleOption);

    expect(screen.getByRole('radio', { name: 'Weiblich' })).toBeSelected();
  });

  it('speichert den Anzeigenamen über Weiter und überspringt den Schritt separat', async () => {
    const user = userEvent.setup();
    const onNext = jest.fn();
    const onSkip = jest.fn();
    mockCaloriesTrackingEnabled = false;

    await render(<ProfileStepForm onNext={onNext} onSkip={onSkip} />);

    await user.type(screen.getByLabelText('Rufname / Anzeigename'), 'Marco');
    await user.press(screen.getByRole('button', { name: 'Weiter' }));

    expect(mockUpdateProfileData).toHaveBeenCalledWith({ displayName: 'Marco' });
    expect(onNext).toHaveBeenCalledTimes(1);

    await user.press(screen.getByRole('button', { name: 'Später ausfüllen' }));

    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
