import { z } from 'zod';

import { ACTIVITY_LEVEL_VALUES, normalizeDateInput, SEX_VALUES } from '@/lib/db/zod/profile.zod';

export type ProfileSex = (typeof SEX_VALUES)[number];
export type ProfileActivityLevel = (typeof ACTIVITY_LEVEL_VALUES)[number];

export const profileBiometricsSchema = z.object({
  birthDate: z.string().nullable(),
  heightCm: z.number().nullable(),
  weightKg: z.number().nullable(),
  sex: z.enum(SEX_VALUES).nullable(),
  activityLevel: z.enum(ACTIVITY_LEVEL_VALUES).nullable(),
});

export type ProfileBiometrics = z.infer<typeof profileBiometricsSchema>;

export type ProfileBiometricsDraft = {
  birthDate: string;
  heightCm: string;
  weightKg: string;
  sex: ProfileSex | null;
  activityLevel: ProfileActivityLevel | null;
};

export const SEX_OPTIONS: readonly { value: ProfileSex; label: string }[] = [
  { value: 'male', label: 'Männlich' },
  { value: 'female', label: 'Weiblich' },
];

export const ACTIVITY_OPTIONS: readonly {
  value: ProfileActivityLevel;
  label: string;
}[] = [
  { value: 'sedentary', label: 'Kaum Bewegung' },
  { value: 'light', label: 'Leicht aktiv' },
  { value: 'moderate', label: 'Mäßig aktiv' },
  { value: 'active', label: 'Aktiv' },
  { value: 'very_active', label: 'Sehr aktiv' },
];

export const EMPTY_PROFILE_BIOMETRICS: ProfileBiometrics = {
  birthDate: null,
  heightCm: null,
  weightKg: null,
  sex: null,
  activityLevel: null,
};

function optionalNumber(minimum: number, maximum: number, message: string) {
  return z
    .string()
    .trim()
    .refine((value) => {
      if (!value) return true;
      const number = Number(value.replace(',', '.'));
      return Number.isFinite(number) && number >= minimum && number <= maximum;
    }, message)
    .transform((value) => (value ? Number(value.replace(',', '.')) : null));
}

export const profileBiometricsDraftSchema = z.object({
  birthDate: z
    .string()
    .trim()
    .refine(
      (value) => !value || normalizeDateInput(value) !== null,
      'Bitte als TT.MM.JJJJ eingeben.',
    )
    .transform((value) => (value ? normalizeDateInput(value) : null))
    .refine(
      (value) => !value || new Date(`${value}T00:00:00`) <= new Date(),
      'Das Geburtsdatum kann nicht in der Zukunft liegen.',
    ),
  heightCm: optionalNumber(0.1, 299.9, 'Bitte eine verlässliche Größe unter 300 cm eingeben.'),
  weightKg: optionalNumber(20, 300, 'Bitte ein verlässliches Gewicht von 20–300 kg eingeben.'),
  sex: z.enum(SEX_VALUES).nullable(),
  activityLevel: z.enum(ACTIVITY_LEVEL_VALUES).nullable(),
});

export function parseProfileBiometricsDraft(draft: ProfileBiometricsDraft): ProfileBiometrics {
  return profileBiometricsDraftSchema.parse(draft);
}

export function toProfileBiometricsDraft(value: ProfileBiometrics): ProfileBiometricsDraft {
  return {
    birthDate: value.birthDate ? formatBirthDate(value.birthDate) : '',
    heightCm: value.heightCm?.toLocaleString('de-DE', { maximumFractionDigits: 1 }) ?? '',
    weightKg: value.weightKg?.toLocaleString('de-DE', { maximumFractionDigits: 1 }) ?? '',
    sex: value.sex,
    activityLevel: value.activityLevel,
  };
}

export function formatBirthDate(value: string | null) {
  if (!value) return 'Nicht gesetzt';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
}
