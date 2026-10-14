import { z } from 'zod';
import { firstFieldErrors } from '@/lib/db/zod/errors';
import { onboardingProfileFormSchema, onboardingProfileSchema } from '@/lib/db/zod/onboarding.zod';
import {
  ACTIVITY_LEVEL_VALUES,
  profileUpdateSchema,
  SEX_VALUES,
  toProfileDatabaseUpdate,
} from '@/lib/db/zod/profile.zod';

describe('profile validation contracts', () => {
  test('normalizes shared profile fields consistently', () => {
    expect(
      profileUpdateSchema.parse({
        displayName: '  Marco  ',
        birthDate: '12.04.1991',
        heightCm: 178,
      }),
    ).toEqual({ displayName: 'Marco', birthDate: '1991-04-12', heightCm: 178 });
    expect(onboardingProfileSchema.safeParse({ heightCm: 300 }).success).toBe(false);
  });

  test('normalizes optional onboarding fields and localized decimal input', () => {
    expect(
      onboardingProfileFormSchema.parse({
        displayName: '  ',
        birthDate: '',
        heightCm: '',
        weightKg: '  ',
      }),
    ).toEqual({
      displayName: undefined,
      birthDate: undefined,
      heightCm: undefined,
      weightKg: undefined,
    });

    expect(
      onboardingProfileFormSchema.parse({
        displayName: '  Ana  ',
        birthDate: '12.04.1991',
        heightCm: '178,5',
        weightKg: '70',
        sex: 'female',
        activityLevel: 'moderate',
        weightGoal: 'maintain',
      }),
    ).toEqual({
      displayName: 'Ana',
      birthDate: '1991-04-12',
      heightCm: 178.5,
      weightKg: 70,
      sex: 'female',
      activityLevel: 'moderate',
      weightGoal: 'maintain',
    });
  });

  test('rejects invalid onboarding dates, measurements and enum values', () => {
    const invalidProfiles = [
      { displayName: 'A'.repeat(81), birthDate: '' },
      { displayName: 'Ana', birthDate: 'not-a-date' },
      { displayName: 'Ana', birthDate: '31.12.2999' },
      { displayName: 'Ana', birthDate: '', heightCm: 'nope' },
      { displayName: 'Ana', birthDate: '', heightCm: '0' },
      { displayName: 'Ana', birthDate: '', heightCm: '300' },
      { displayName: 'Ana', birthDate: '', weightKg: 'Infinity' },
      { displayName: 'Ana', birthDate: '', weightKg: '19.9' },
      { displayName: 'Ana', birthDate: '', weightKg: '301' },
      { displayName: 'Ana', birthDate: '', sex: 'divers' },
      { displayName: 'Ana', birthDate: '', activityLevel: 'extrem' },
      { displayName: 'Ana', birthDate: '', weightGoal: 'stay' },
    ];

    for (const profile of invalidProfiles) {
      expect(onboardingProfileFormSchema.safeParse(profile).success).toBe(false);
    }
  });

  test('matches the values allowed by public.profiles', () => {
    expect(SEX_VALUES).toEqual(['male', 'female']);
    expect(ACTIVITY_LEVEL_VALUES).toEqual([
      'sedentary',
      'light',
      'moderate',
      'active',
      'very_active',
    ]);
    expect(profileUpdateSchema.safeParse({ sex: 'divers' }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ activityLevel: 'extrem' }).success).toBe(false);
    const sql = readFileSync(join(process.cwd(), 'supabase/schemas/02_profiles.sql'), 'utf8');
    for (const value of [...SEX_VALUES, ...ACTIVITY_LEVEL_VALUES]) {
      expect(sql).toContain(`'${value}'`);
    }
    expect(sql).toContain('height_cm > 0 and height_cm < 300');
    expect(sql).toContain('weight_kg > 0 and weight_kg < 700');
  });

  test('keeps nullable database fields clearable and optional in partial updates', () => {
    expect(profileUpdateSchema.parse({})).toEqual({});
    expect(
      profileUpdateSchema.parse({
        displayName: null,
        birthDate: null,
        sex: null,
        heightCm: null,
        weightKg: null,
        activityLevel: null,
        avatarUrl: null,
      }),
    ).toEqual({
      displayName: null,
      birthDate: null,
      sex: null,
      heightCm: null,
      weightKg: null,
      activityLevel: null,
      avatarUrl: null,
    });
  });

  test('maps validated values to the generated Supabase update contract', () => {
    expect(toProfileDatabaseUpdate(profileUpdateSchema.parse({ displayName: ' Marco ' }))).toEqual({
      display_name: 'Marco',
    });
  });

  test('returns only the first message for each flat field', () => {
    const result = z
      .object({ name: z.string().min(2, 'zu kurz').regex(/^A/, 'muss mit A beginnen') })
      .safeParse({ name: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstFieldErrors(result.error)).toEqual({ name: 'zu kurz' });
  });

  test('ignores root-level and empty field messages', () => {
    const rootError = z
      .string()
      .refine(() => false, 'form error')
      .safeParse('value');
    const emptyFieldError = new z.ZodError([{ code: 'custom', path: ['name'], message: '' }]);

    expect(rootError.success).toBe(false);
    if (!rootError.success) expect(firstFieldErrors(rootError.error)).toEqual({});
    expect(firstFieldErrors(emptyFieldError)).toEqual({});
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
