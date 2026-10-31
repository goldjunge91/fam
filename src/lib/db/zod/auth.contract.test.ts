import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AUTH_VALIDATION_KEYS,
  confirmationCodeSchema,
  emailSchema,
  newPasswordSchema,
  newPasswordValueSchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  signInSchema,
  signUpSchema,
  translateAuthValidationMessage,
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

  test('translates known validation keys with length counts and preserves unknown text', () => {
    const translate = jest.fn((key: string, options?: { count?: number }) =>
      options?.count === undefined ? `translated:${key}` : `translated:${key}:${options.count}`,
    );

    expect(translateAuthValidationMessage(undefined, translate)).toBeUndefined();
    expect(translateAuthValidationMessage('', translate)).toBeUndefined();
    expect(translateAuthValidationMessage('A custom message', translate)).toBe('A custom message');

    expect(translateAuthValidationMessage(AUTH_VALIDATION_KEYS.emailRequired, translate)).toBe(
      `translated:${AUTH_VALIDATION_KEYS.emailRequired}`,
    );
    expect(translateAuthValidationMessage(AUTH_VALIDATION_KEYS.emailInvalid, translate)).toBe(
      `translated:${AUTH_VALIDATION_KEYS.emailInvalid}`,
    );
    expect(translateAuthValidationMessage(AUTH_VALIDATION_KEYS.passwordMismatch, translate)).toBe(
      `translated:${AUTH_VALIDATION_KEYS.passwordMismatch}`,
    );
    expect(translateAuthValidationMessage(AUTH_VALIDATION_KEYS.codeInvalid, translate)).toBe(
      `translated:${AUTH_VALIDATION_KEYS.codeInvalid}`,
    );
    expect(translateAuthValidationMessage(AUTH_VALIDATION_KEYS.passwordMin, translate)).toBe(
      `translated:${AUTH_VALIDATION_KEYS.passwordMin}:${PASSWORD_MIN_LENGTH}`,
    );
    expect(translateAuthValidationMessage(AUTH_VALIDATION_KEYS.passwordMax, translate)).toBe(
      `translated:${AUTH_VALIDATION_KEYS.passwordMax}:${PASSWORD_MAX_LENGTH}`,
    );
    expect(translate).toHaveBeenNthCalledWith(5, AUTH_VALIDATION_KEYS.passwordMin, {
      count: PASSWORD_MIN_LENGTH,
    });
    expect(translate).toHaveBeenNthCalledWith(6, AUTH_VALIDATION_KEYS.passwordMax, {
      count: PASSWORD_MAX_LENGTH,
    });
  });

  test('requires matching values when setting a new password', () => {
    const result = newPasswordSchema.safeParse({
      password: 'new-password',
      passwordConfirmation: 'different-password',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        message: AUTH_VALIDATION_KEYS.passwordMismatch,
        path: ['passwordConfirmation'],
      });
    }
  });
});
