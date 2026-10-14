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

  test('starts and resets with the initial module selection', () => {
    expect(useOnboardingStore.getState().state.modules).toEqual({
      fridge: true,
      shoppingList: true,
      calories: false,
      recipes: false,
      mealPlanner: true,
    });

    useOnboardingStore.getState().updateModulesData({ calories: true });
    useOnboardingStore.getState().reset();

    expect(useOnboardingStore.getState().state.modules).toEqual({
      fridge: true,
      shoppingList: true,
      calories: false,
      recipes: false,
      mealPlanner: true,
    });
  });

  test('merges household and permission changes while keeping navigation at step one or later', () => {
    const store = useOnboardingStore.getState();
    store.updateHouseholdData({ choice: 'create', name: '  Zuhause  ' });
    store.updatePermissionsData({ notificationsRequested: true, cameraRequested: true });
    store.setStep(3);
    store.prevStep();

    expect(useOnboardingStore.getState().state).toMatchObject({
      currentStep: 2,
      household: { choice: 'create', name: '  Zuhause  ' },
      permissions: { notificationsRequested: true, cameraRequested: true },
    });

    store.prevStep();
    store.prevStep();
    expect(useOnboardingStore.getState().state.currentStep).toBe(1);
  });

  test('updates status and clears loading and errors when resetting', () => {
    useOnboardingStore.getState().setStatus({ isLoading: true, error: 'Save failed' });

    expect(useOnboardingStore.getState()).toMatchObject({ isLoading: true, error: 'Save failed' });

    useOnboardingStore.getState().reset();
    expect(useOnboardingStore.getState()).toMatchObject({ isLoading: false, error: null });
  });
});
