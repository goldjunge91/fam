import * as sharedBiometrics from './biometrics';
import * as androidBiometrics from './biometrics.android';

const implementations: readonly (readonly [string, typeof sharedBiometrics])[] = [
  ['shared', sharedBiometrics],
  ['Android', androidBiometrics],
];

for (const [platform, biometrics] of implementations) {
  describe(`profile biometrics (${platform})`, () => {
    const {
      ACTIVITY_OPTIONS,
      formatBirthDate,
      parseProfileBiometricsDraft,
      SEX_OPTIONS,
      toProfileBiometricsDraft,
    } = biometrics;

    test('normalisiert Profilangaben und deutsche Dezimalzahlen', () => {
      expect(
        parseProfileBiometricsDraft({
          birthDate: '15.05.1990',
          heightCm: '178,5',
          weightKg: '80,2',
          sex: 'male',
          activityLevel: 'moderate',
        }),
      ).toEqual({
        birthDate: '1990-05-15',
        heightCm: 178.5,
        weightKg: 80.2,
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
          weightKg: '',
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

    test('behandelt fehlende Profilwerte und bestehende Datumsformate', () => {
      expect(formatBirthDate(null)).toBe('Nicht gesetzt');
      expect(formatBirthDate('legacy-date')).toBe('legacy-date');
      expect(
        toProfileBiometricsDraft({
          birthDate: null,
          heightCm: null,
          weightKg: null,
          sex: null,
          activityLevel: null,
        }),
      ).toEqual({
        birthDate: '',
        heightCm: '',
        weightKg: '',
        sex: null,
        activityLevel: null,
      });
    });

    test('weist ungültige und zukünftige Geburtsdaten zurück', () => {
      for (const birthDate of ['31.02.1990', '01.01.2999']) {
        expect(() =>
          parseProfileBiometricsDraft({
            birthDate,
            heightCm: '',
            weightKg: '',
            sex: null,
            activityLevel: null,
          }),
        ).toThrow();
      }
    });

    test('akzeptiert Werte an den dokumentierten Größen- und Gewichtsgrenzen', () => {
      expect(
        parseProfileBiometricsDraft({
          birthDate: '',
          heightCm: '0,1',
          weightKg: '300',
          sex: null,
          activityLevel: null,
        }),
      ).toEqual({
        birthDate: null,
        heightCm: 0.1,
        weightKg: 300,
        sex: null,
        activityLevel: null,
      });
    });
  });
}
