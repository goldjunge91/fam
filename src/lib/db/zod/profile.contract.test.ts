import { z } from 'zod';
import { firstFieldErrors } from '@/lib/db/zod/errors';
import { onboardingProfileSchema } from '@/lib/db/zod/onboarding.zod';
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
  });

  test('keeps nullable database fields clearable and optional in partial updates', () => {
    expect(profileUpdateSchema.parse({})).toEqual({});
    expect(
      profileUpdateSchema.parse({
        displayName: null,
        birthDate: null,
        sex: null,
        heightCm: null,
        activityLevel: null,
        avatarUrl: null,
      }),
    ).toEqual({
      displayName: null,
      birthDate: null,
      sex: null,
      heightCm: null,
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
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
