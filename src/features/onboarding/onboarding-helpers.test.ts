import {
  dateInputToIso,
  formatDateInput,
  isoDateToInput,
  validateHouseholdOnboarding,
  validateOnboardingProfile,
} from './onboarding-helpers';

describe('onboarding date helpers', () => {
  it('formats German partial input, strips non-digits, and caps the input at eight digits', () => {
    expect(formatDateInput('')).toBe('');
    expect(formatDateInput('1a')).toBe('1');
    expect(formatDateInput('a12b09c1990d123')).toBe('12.09.1990');
  });

  it('formats and parses English month/day input', () => {
    expect(formatDateInput('a05141990d', 'mdy')).toBe('05/14/1990');
    expect(dateInputToIso('05/14/1990', 'mdy')).toBe('1990-05-14');
    expect(dateInputToIso('14/05/1990', 'mdy')).toBeUndefined();
  });

  it('normalizes valid German dates and rejects impossible dates', () => {
    expect(dateInputToIso('1.2.1990')).toBe('1990-02-01');
    expect(dateInputToIso('31.02.1990')).toBeUndefined();
    expect(dateInputToIso('')).toBeUndefined();
  });

  it('formats ISO dates for German and English display and leaves unrelated values unchanged', () => {
    expect(isoDateToInput('1990-02-01')).toBe('01.02.1990');
    expect(isoDateToInput('1990-02-01', 'mdy')).toBe('02/01/1990');
    expect(isoDateToInput('not-a-date')).toBe('not-a-date');
  });
});

describe('onboarding profile validation', () => {
  it('accepts an empty profile and values at the documented limits', () => {
    expect(validateOnboardingProfile({})).toEqual({ isValid: true, errors: [] });
    expect(
      validateOnboardingProfile({ birthDate: '1990-01-01', heightCm: 50, weightKg: 20 }),
    ).toEqual({ isValid: true, errors: [] });
    expect(validateOnboardingProfile({ heightCm: 250, weightKg: 300 }).isValid).toBe(true);
  });

  it('reports implausible measurements and invalid or future birth dates', () => {
    expect(validateOnboardingProfile({ heightCm: 49, weightKg: 19 })).toEqual({
      isValid: false,
      errors: [
        'Größe muss zwischen 50 und 250 cm liegen.',
        'Gewicht muss zwischen 20 und 300 kg liegen.',
      ],
    });
    expect(validateOnboardingProfile({ heightCm: 251, weightKg: 301 }).errors).toHaveLength(2);
    expect(validateOnboardingProfile({ birthDate: 'not-a-date' }).isValid).toBe(false);
    expect(validateOnboardingProfile({ birthDate: '2999-01-01' }).isValid).toBe(false);
  });
});

describe('household onboarding validation', () => {
  it('requires a non-blank name when creating a household', () => {
    expect(validateHouseholdOnboarding({ choice: 'create', name: ' Familie ' })).toBe(true);
    expect(validateHouseholdOnboarding({ choice: 'create', name: '   ' })).toBe(false);
    expect(validateHouseholdOnboarding({ choice: 'create' })).toBe(false);
  });

  it('requires a non-blank invite code when joining and accepts solo mode', () => {
    expect(validateHouseholdOnboarding({ choice: 'join', inviteCode: ' ABC123 ' })).toBe(true);
    expect(validateHouseholdOnboarding({ choice: 'join', inviteCode: '  ' })).toBe(false);
    expect(validateHouseholdOnboarding({ choice: 'join' })).toBe(false);
    expect(validateHouseholdOnboarding({ choice: 'solo' })).toBe(true);
  });
});
