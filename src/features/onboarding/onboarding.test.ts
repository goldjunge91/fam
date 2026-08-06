import { describe, expect, test } from 'bun:test';
import type {
  HouseholdOnboardingData,
  ModulePreferencesData,
  OnboardingProfileData,
} from './types';

describe('Onboarding State Validation', () => {
  test('Profil-Körperwerte Plausibilität', () => {
    const validProfile: OnboardingProfileData = {
      displayName: 'Max',
      heightCm: 180,
      weightKg: 75,
      sex: 'male',
      activityLevel: 'moderate',
    };

    expect(validProfile.heightCm).toBeGreaterThanOrEqual(50);
    expect(validProfile.heightCm).toBeLessThanOrEqual(250);
    expect(validProfile.weightKg).toBeGreaterThanOrEqual(20);
    expect(validProfile.weightKg).toBeLessThanOrEqual(300);
  });

  test('Haushalt Setup Standard-Werte', () => {
    const defaultHousehold: HouseholdOnboardingData = {
      choice: 'solo',
    };

    expect(defaultHousehold.choice).toBe('solo');
    expect(defaultHousehold.name).toBeUndefined();
  });

  test('Modulpräferenzen sind standardmäßig alle aktiv', () => {
    const defaultModules: ModulePreferencesData = {
      fridge: true,
      shoppingList: true,
      calories: true,
      recipes: true,
    };

    expect(defaultModules.fridge).toBe(true);
    expect(defaultModules.shoppingList).toBe(true);
    expect(defaultModules.calories).toBe(true);
    expect(defaultModules.recipes).toBe(true);
  });
});
