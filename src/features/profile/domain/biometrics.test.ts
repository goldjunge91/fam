import {
  ACTIVITY_OPTIONS,
  parseProfileBiometricsDraft,
  SEX_OPTIONS,
  toProfileBiometricsDraft,
} from '@/features/profile/domain/biometrics';

describe('profile biometrics', () => {
  test('normalisiert Profilangaben und deutsche Dezimalzahlen', () => {
    expect(
      parseProfileBiometricsDraft({
        birthDate: '15.05.1990',
        heightCm: '178,5',
        weightKg: '81,2',
        sex: 'male',
        activityLevel: 'moderate',
      }),
    ).toEqual({
      birthDate: '1990-05-15',
      heightCm: 178.5,
      weightKg: 81.2,
      sex: 'male',
      activityLevel: 'moderate',
    });
  });

  test('behandelt noch nicht erfasste optionale Angaben als null', () => {
    expect(
      parseProfileBiometricsDraft({
        birthDate: '',
        heightCm: '',
        weightKg: '',
        sex: null,
        activityLevel: null,
      }),
    ).toEqual({
      birthDate: null,
      heightCm: null,
      weightKg: null,
      sex: null,
      activityLevel: null,
    });
  });

  test('weist unplausible Körperwerte zurück', () => {
    expect(() =>
      parseProfileBiometricsDraft({
        birthDate: '15.05.1990',
        heightCm: '301',
        weightKg: '10',
        sex: null,
        activityLevel: null,
      }),
    ).toThrow();
  });

  test('hält Auswahlwerte und Beschriftungen stabil', () => {
    expect(SEX_OPTIONS).toEqual([
      { value: 'male', label: 'Männlich' },
      { value: 'female', label: 'Weiblich' },
    ]);
    expect(ACTIVITY_OPTIONS.map(({ value }) => value)).toEqual([
      'sedentary',
      'light',
      'moderate',
      'active',
      'very_active',
    ]);
  });

  test('formatiert das gespeicherte Geburtsdatum für die deutsche Profileingabe', () => {
    expect(
      toProfileBiometricsDraft({
        birthDate: '1990-10-10',
        heightCm: 180,
        weightKg: 80.9,
        sex: 'male',
        activityLevel: 'light',
      }).birthDate,
    ).toBe('10.10.1990');
  });
});
