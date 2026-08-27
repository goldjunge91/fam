import { z } from 'zod';
import type { Database } from '@/lib/database.types';
import { emailSchema, newPasswordValueSchema } from '@/lib/db/zod/auth.zod';

export const SEX_VALUES = ['male', 'female'] as const;
export const ACTIVITY_LEVEL_VALUES = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
] as const;

export function normalizeDateInput(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const iso = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(value);
  const local = /^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/.exec(value);
  const parts = iso
    ? { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }
    : local
      ? { year: Number(local[3]), month: Number(local[2]), day: Number(local[1]) }
      : null;
  if (!parts) return null;
  const date = new Date(parts.year, parts.month - 1, parts.day);
  if (
    date.getFullYear() !== parts.year ||
    date.getMonth() !== parts.month - 1 ||
    date.getDate() !== parts.day
  )
    return null;
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

const optionalBirthDateSchema = z
  .string()
  .transform((value, context) => {
    const normalized = normalizeDateInput(value);
    if (!normalized) {
      context.addIssue({
        code: 'custom',
        message: 'Bitte gib ein gültiges Datum ein (z.B. 15.05.1990).',
      });
      return z.NEVER;
    }
    return normalized;
  })
  .refine(
    (value) => new Date(value) <= new Date(),
    'Das Geburtsdatum kann nicht in der Zukunft liegen.',
  );

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1, 'Bitte gib einen Namen ein.').max(80).nullable().optional(),
  birthDate: optionalBirthDateSchema.nullable().optional(),
  sex: z.enum(SEX_VALUES).nullable().optional(),
  heightCm: z
    .number()
    .positive('Die Größe muss größer als 0 sein.')
    .lt(300, 'Bitte gib die Größe in Zentimetern an.')
    .nullable()
    .optional(),
  activityLevel: z.enum(ACTIVITY_LEVEL_VALUES).nullable().optional(),
  avatarUrl: z.url().nullable().optional(),
});

export const profileAccountFormSchema = z
  .object({
    displayName: z.string().trim().min(1, 'Bitte gib einen Namen ein.').max(80),
    email: emailSchema,
    newPassword: z.union([z.literal(''), newPasswordValueSchema]),
    passwordConfirmation: z.string(),
  })
  .refine(({ newPassword, passwordConfirmation }) => newPassword === passwordConfirmation, {
    message: 'Die Passwörter stimmen nicht überein.',
    path: ['passwordConfirmation'],
  });

export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;
export type ProfileUpdate = z.output<typeof profileUpdateSchema>;
export type ProfileAccountForm = z.output<typeof profileAccountFormSchema>;
export type ProfileDatabaseUpdate = Database['public']['Tables']['profiles']['Update'];

export function toProfileDatabaseUpdate(input: ProfileUpdate): ProfileDatabaseUpdate {
  return {
    ...(input.displayName !== undefined && { display_name: input.displayName }),
    ...(input.birthDate !== undefined && { birth_date: input.birthDate }),
    ...(input.sex !== undefined && { sex: input.sex }),
    ...(input.heightCm !== undefined && { height_cm: input.heightCm }),
    ...(input.activityLevel !== undefined && { activity_level: input.activityLevel }),
    ...(input.avatarUrl !== undefined && { avatar_url: input.avatarUrl }),
  };
}
