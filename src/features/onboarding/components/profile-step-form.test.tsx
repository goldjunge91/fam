import { render, screen } from '@testing-library/react-native';

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

describe('ProfileStepForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCaloriesTrackingEnabled = true;
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
});
