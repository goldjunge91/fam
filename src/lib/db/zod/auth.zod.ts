import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export const AUTH_VALIDATION_KEYS = {
  emailRequired: 'auth.validation.emailRequired',
  emailInvalid: 'auth.validation.emailInvalid',
  passwordMin: 'auth.validation.passwordMin',
  passwordMax: 'auth.validation.passwordMax',
  passwordMismatch: 'auth.validation.passwordMismatch',
  codeInvalid: 'auth.validation.codeInvalid',
} as const;

type AuthValidationKey = (typeof AUTH_VALIDATION_KEYS)[keyof typeof AUTH_VALIDATION_KEYS];
type AuthValidationTranslator = (key: AuthValidationKey, options?: { count?: number }) => string;

/** Übersetzt bekannte Zod-Fehlerschlüssel an der Anzeigegrenze. */
export function translateAuthValidationMessage(
  message: string | undefined,
  translate: AuthValidationTranslator,
): string | undefined {
  if (!message) return undefined;

  switch (message) {
    case AUTH_VALIDATION_KEYS.emailRequired:
    case AUTH_VALIDATION_KEYS.emailInvalid:
    case AUTH_VALIDATION_KEYS.passwordMismatch:
    case AUTH_VALIDATION_KEYS.codeInvalid:
      return translate(message);
    case AUTH_VALIDATION_KEYS.passwordMin:
      return translate(message, { count: PASSWORD_MIN_LENGTH });
    case AUTH_VALIDATION_KEYS.passwordMax:
      return translate(message, { count: PASSWORD_MAX_LENGTH });
    default:
      return message;
  }
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, AUTH_VALIDATION_KEYS.emailRequired)
  .email(AUTH_VALIDATION_KEYS.emailInvalid);

export const newPasswordValueSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, AUTH_VALIDATION_KEYS.passwordMin)
  .max(PASSWORD_MAX_LENGTH, AUTH_VALIDATION_KEYS.passwordMax);

export const signInSchema = z.object({
  email: emailSchema,
  password: newPasswordValueSchema,
});

export const signUpSchema = z
  .object({
    email: emailSchema,
    password: newPasswordValueSchema,
    passwordConfirmation: z.string(),
  })
  .refine(({ password, passwordConfirmation }) => password === passwordConfirmation, {
    message: AUTH_VALIDATION_KEYS.passwordMismatch,
    path: ['passwordConfirmation'],
  });

export const passwordResetRequestSchema = z.object({ email: emailSchema });

export const confirmationCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, AUTH_VALIDATION_KEYS.codeInvalid),
});

export const newPasswordSchema = z
  .object({ password: newPasswordValueSchema, passwordConfirmation: z.string() })
  .refine(({ password, passwordConfirmation }) => password === passwordConfirmation, {
    message: AUTH_VALIDATION_KEYS.passwordMismatch,
    path: ['passwordConfirmation'],
  });

export type ConfirmationCodeInput = z.output<typeof confirmationCodeSchema>;
export type SignInInput = z.output<typeof signInSchema>;
export type SignUpInput = z.output<typeof signUpSchema>;
export type PasswordResetRequestInput = z.output<typeof passwordResetRequestSchema>;
export type NewPasswordInput = z.output<typeof newPasswordSchema>;
