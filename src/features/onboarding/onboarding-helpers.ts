import { normalizeDateInput } from '@/features/auth/auth-schemas';
import type { HouseholdOnboardingData, OnboardingProfileData } from './types';

/**
 * Formatiert eine laufende Eingabe zu TT.MM.JJJJ, indem Punkte automatisch
 * nach Tag und Monat eingefügt werden. Nicht-Ziffern werden verworfen.
 */
export function formatGermanDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join('.');
}

export function germanDateToIso(value: string): string | undefined {
  return normalizeDateInput(value) ?? undefined;
}

/** Wandelt ISO (JJJJ-MM-TT) in TT.MM.JJJJ für die Anzeige um. */
export function isoDateToGerman(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}.${month}.${year}`;
}

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
