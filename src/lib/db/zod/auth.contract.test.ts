import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  confirmationCodeSchema,
  emailSchema,
  newPasswordValueSchema,
  PASSWORD_MIN_LENGTH,
  signInSchema,
  signUpSchema,
} from '@/lib/db/zod/auth.zod';

describe('auth validation contracts', () => {
  test('normalizes email and enforces the shared password policy at sign-in', () => {
    expect(signInSchema.parse({ email: ' Name@Beispiel.de ', password: 'langgenug' })).toEqual({
      email: 'name@beispiel.de',
      password: 'langgenug',
    });
    expect(signInSchema.safeParse({ email: 'name@beispiel.de', password: 'kurz' }).success).toBe(
      false,
    );
  });

  test('uses the configured minimum length for every new password', () => {
    expect(
      signUpSchema.safeParse({
        email: 'name@beispiel.de',
        password: '1234567',
        passwordConfirmation: '1234567',
      }).success,
    ).toBe(false);

    const config = readFileSync(join(process.cwd(), 'supabase/config.toml'), 'utf8');
    const configuredMinimum = Number(config.match(/minimum_password_length\s*=\s*(\d+)/)?.[1]);
    expect(configuredMinimum).toBe(PASSWORD_MIN_LENGTH);
  });

  test('accepts confirmation codes only when they contain exactly six digits', () => {
    expect(confirmationCodeSchema.parse({ code: ' 123456 ' })).toEqual({ code: '123456' });
    expect(confirmationCodeSchema.safeParse({ code: '12345a' }).success).toBe(false);
  });

  test('returns stable translation keys for validation errors', () => {
    const missingEmail = emailSchema.safeParse('');
    const shortPassword = newPasswordValueSchema.safeParse('kurz');
    const mismatchedPasswords = signUpSchema.safeParse({
      email: 'name@beispiel.de',
      password: 'langgenug',
      passwordConfirmation: 'andersgenug',
    });
    const invalidCode = confirmationCodeSchema.safeParse({ code: '12345a' });

    expect(missingEmail.success).toBe(false);
    expect(shortPassword.success).toBe(false);
    expect(mismatchedPasswords.success).toBe(false);
    expect(invalidCode.success).toBe(false);

    if (!missingEmail.success) {
      expect(missingEmail.error.issues[0]?.message).toBe('auth.validation.emailRequired');
    }
    if (!shortPassword.success) {
      expect(shortPassword.error.issues[0]?.message).toBe('auth.validation.passwordMin');
    }
    if (!mismatchedPasswords.success) {
      expect(mismatchedPasswords.error.issues[0]?.message).toBe('auth.validation.passwordMismatch');
    }
    if (!invalidCode.success) {
      expect(invalidCode.error.issues[0]?.message).toBe('auth.validation.codeInvalid');
    }
  });
});
