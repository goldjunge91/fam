import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Bitte gib deine E-Mail-Adresse ein.')
  .email('Das sieht nicht wie eine E-Mail-Adresse aus.');

export const newPasswordValueSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Das Passwort braucht mindestens ${PASSWORD_MIN_LENGTH} Zeichen.`)
  .max(PASSWORD_MAX_LENGTH, `Das Passwort darf höchstens ${PASSWORD_MAX_LENGTH} Zeichen haben.`);

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
    message: 'Die Passwörter stimmen nicht überein.',
    path: ['passwordConfirmation'],
  });

export const passwordResetRequestSchema = z.object({ email: emailSchema });

export const confirmationCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Bitte die 6 Ziffern aus der E-Mail eingeben.'),
});

export const newPasswordSchema = z
  .object({ password: newPasswordValueSchema, passwordConfirmation: z.string() })
  .refine(({ password, passwordConfirmation }) => password === passwordConfirmation, {
    message: 'Die Passwörter stimmen nicht überein.',
    path: ['passwordConfirmation'],
  });

export type ConfirmationCodeInput = z.output<typeof confirmationCodeSchema>;
export type SignInInput = z.output<typeof signInSchema>;
export type SignUpInput = z.output<typeof signUpSchema>;
export type PasswordResetRequestInput = z.output<typeof passwordResetRequestSchema>;
export type NewPasswordInput = z.output<typeof newPasswordSchema>;
