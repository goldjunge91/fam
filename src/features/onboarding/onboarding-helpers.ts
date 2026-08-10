import type { HouseholdOnboardingData, OnboardingProfileData } from './types';

/**
 * Validiert die Eingabedaten für ein Onboarding-Profil auf Plausibilität.
 */
export function validateOnboardingProfile(profile: OnboardingProfileData): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (profile.heightCm !== undefined) {
    if (profile.heightCm < 50 || profile.heightCm > 250) {
      errors.push('Größe muss zwischen 50 und 250 cm liegen.');
    }
  }

  if (profile.weightKg !== undefined) {
    if (profile.weightKg < 20 || profile.weightKg > 300) {
      errors.push('Gewicht muss zwischen 20 und 300 kg liegen.');
    }
  }

  if (profile.birthDate) {
    const date = new Date(profile.birthDate);
    if (Number.isNaN(date.getTime()) || date > new Date()) {
      errors.push('Geburtsdatum darf nicht in der Zukunft liegen.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validiert die Haushalts-Auswahl im Onboarding.
 */
export function validateHouseholdOnboarding(household: HouseholdOnboardingData): boolean {
  if (household.choice === 'create') {
    return !!household.name && household.name.trim().length > 0;
  }
  if (household.choice === 'join') {
    return !!household.inviteCode && household.inviteCode.trim().length > 0;
  }
  return household.choice === 'solo';
}
