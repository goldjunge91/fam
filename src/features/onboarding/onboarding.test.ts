import { validateHouseholdOnboarding, validateOnboardingProfile } from './onboarding-helpers';
import type { HouseholdOnboardingData, OnboardingProfileData } from './types';

describe('Onboarding State Validation', () => {
  describe('validateOnboardingProfile', () => {
    it('sollte gültige Körperwerte akzeptieren', () => {
      const validProfile: OnboardingProfileData = {
        displayName: 'Max',
        heightCm: 180,
        weightKg: 75,
        sex: 'male',
        activityLevel: 'moderate',
      };

      const result = validateOnboardingProfile(validProfile);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('sollte ungültige Körperwerte (Größe/Gewicht außerhalb der Grenzen) ablehnen', () => {
      const invalidProfile: OnboardingProfileData = {
        heightCm: 30, // unter 50cm
        weightKg: 350, // über 300kg
      };

      const result = validateOnboardingProfile(invalidProfile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Größe muss zwischen 50 und 250 cm liegen.');
      expect(result.errors).toContain('Gewicht muss zwischen 20 und 300 kg liegen.');
    });

    it('sollte ein Zukunfts-Geburtsdatum ablehnen', () => {
      const futureProfile: OnboardingProfileData = {
        birthDate: '2099-01-01',
      };

      const result = validateOnboardingProfile(futureProfile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Geburtsdatum darf nicht in der Zukunft liegen.');
    });
  });

  describe('validateHouseholdOnboarding', () => {
    it('sollte "solo" Wahl immer akzeptieren', () => {
      const soloChoice: HouseholdOnboardingData = { choice: 'solo' };
      expect(validateHouseholdOnboarding(soloChoice)).toBe(true);
    });

    it('sollte "create" Wahl nur mit nicht-leerem Namen akzeptieren', () => {
      expect(validateHouseholdOnboarding({ choice: 'create', name: '  ' })).toBe(false);
      expect(validateHouseholdOnboarding({ choice: 'create', name: 'Familie Meier' })).toBe(true);
    });

    it('sollte "join" Wahl nur mit nicht-leerem Einladungscode akzeptieren', () => {
      expect(validateHouseholdOnboarding({ choice: 'join', inviteCode: '' })).toBe(false);
      expect(validateHouseholdOnboarding({ choice: 'join', inviteCode: 'code-123' })).toBe(true);
    });
  });
});
