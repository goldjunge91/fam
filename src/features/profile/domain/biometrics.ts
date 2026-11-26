import type { TFunction } from 'i18next';
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

export const SEX_OPTIONS: readonly { value: ProfileSex }[] = [
  { value: 'male' },
  { value: 'female' },
];

export const ACTIVITY_OPTIONS: readonly { value: ProfileActivityLevel }[] = [
  { value: 'sedentary' },
  { value: 'light' },
  { value: 'moderate' },
  { value: 'active' },
  { value: 'very_active' },
];

export function getSexLabel(t: TFunction, value: ProfileSex): string {
  return value === 'male' ? t('profile.sex.male') : t('profile.sex.female');
}

export function getActivityLabel(t: TFunction, value: ProfileActivityLevel): string {
  switch (value) {
    case 'sedentary':
      return t('profile.activity.sedentary');
    case 'light':
      return t('profile.activity.light');
    case 'moderate':
      return t('profile.activity.moderate');
    case 'active':
      return t('profile.activity.active');
    case 'very_active':
      return t('profile.activity.veryActive');
  }
}

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
    birthDate: value.birthDate ? (formatBirthDate(value.birthDate) ?? '') : '',
    heightCm: value.heightCm?.toLocaleString('de-DE', { maximumFractionDigits: 1 }) ?? '',
    weightKg: value.weightKg?.toLocaleString('de-DE', { maximumFractionDigits: 1 }) ?? '',
    sex: value.sex,
    activityLevel: value.activityLevel,
  };
}

export function formatBirthDate(value: string | null): string | null {
  if (!value) return null;
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
}
