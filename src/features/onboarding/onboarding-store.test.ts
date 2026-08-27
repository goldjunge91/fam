import { useOnboardingStore } from '@/features/onboarding/onboarding-store';

describe('onboarding flow state', () => {
  beforeEach(() => useOnboardingStore.getState().reset());

  test('keeps validated step data while navigating and can reset the flow', () => {
    const store = useOnboardingStore.getState();
    store.updateProfileData({ displayName: 'Marco' });
    store.nextStep();

    expect(useOnboardingStore.getState().state).toMatchObject({
      currentStep: 2,
      profile: { displayName: 'Marco' },
    });

    useOnboardingStore.getState().reset();
    expect(useOnboardingStore.getState().state.currentStep).toBe(1);
    expect(useOnboardingStore.getState().state.profile).toEqual({});
  });
});
