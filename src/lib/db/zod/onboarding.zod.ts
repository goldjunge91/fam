import { z } from 'zod';
import { normalizeDateInput, profileUpdateSchema } from '@/lib/db/zod/profile.zod';

export const onboardingProfileSchema = profileUpdateSchema.extend({
  weightKg: z
    .number()
    .min(20, 'Bitte ein verlässliches Gewicht (20–300 kg) eingeben')
    .max(300, 'Bitte ein verlässliches Gewicht (20–300 kg) eingeben')
    .optional(),
  goalWeightKg: z.number().positive().optional(),
  weightGoal: z.enum(['lose_fast', 'lose', 'maintain', 'gain', 'gain_fast']).optional(),
});

export type OnboardingProfileInput = z.input<typeof onboardingProfileSchema>;
export type OnboardingProfile = z.output<typeof onboardingProfileSchema>;

const optionalNumber = (minimum: number, maximum: number, message: string) =>
  z
    .string()
    .refine((value) => {
      if (!value.trim()) return true;
      const number = Number(value.replace(',', '.'));
      return Number.isFinite(number) && number >= minimum && number <= maximum;
    }, message)
    .transform((value) => (value.trim() ? Number(value.replace(',', '.')) : undefined));

export const onboardingProfileFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(80)
    .transform((value) => value || undefined),
  birthDate: z
    .string()
    .refine(
      (value) => !value.trim() || normalizeDateInput(value) !== null,
      'Bitte als TT.MM.JJJJ eingeben',
    )
    .transform((value) => (value.trim() ? (normalizeDateInput(value) ?? undefined) : undefined))
    .refine(
      (value) => !value || new Date(value) <= new Date(),
      'Geburtsdatum darf nicht in der Zukunft liegen',
    ),
  heightCm: optionalNumber(
    0.1,
    299.9,
    'Bitte eine verlässliche Größe (größer 0, unter 300 cm) eingeben',
  ),
  weightKg: optionalNumber(20, 300, 'Bitte ein verlässliches Gewicht (20–300 kg) eingeben'),
  sex: z.enum(['male', 'female']).optional(),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).optional(),
  weightGoal: z.enum(['lose_fast', 'lose', 'maintain', 'gain', 'gain_fast']).optional(),
});

export type OnboardingProfileFormInput = z.input<typeof onboardingProfileFormSchema>;
export type OnboardingProfileForm = z.output<typeof onboardingProfileFormSchema>;
