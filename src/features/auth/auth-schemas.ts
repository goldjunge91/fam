import { z } from 'zod';

const email = z
  .string()
  .trim()
  // Einheitliche Schreibweise fuer Anzeige und Vergleich.
  .toLowerCase()
  .min(1, 'Bitte gib deine E-Mail-Adresse ein.')
  .email('Das sieht nicht wie eine E-Mail-Adresse aus.');

/** Setzt auf Laenge statt vorhersagbare Zeichenklassen-Regeln. */
const password = z
  .string()
  .min(8, 'Das Passwort braucht mindestens 8 Zeichen.')
  .max(72, 'Das Passwort darf höchstens 72 Zeichen haben.');

export const signInSchema = z.object({
  email,
  // Alte, kuerzere Passwoerter muessen weiterhin zur Serverpruefung gelangen.
  password: z.string().min(1, 'Bitte gib dein Passwort ein.'),
});

export const signUpSchema = z
  .object({
    email,
    password,
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Die Passwörter stimmen nicht überein.',
    path: ['passwordConfirmation'],
  });

export const resetRequestSchema = z.object({ email });

/** Validiert den sechsstelligen Mail-Token vor dem Netzwerkaufruf. */
export const confirmationCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Bitte die 6 Ziffern aus der E-Mail eingeben.'),
});

export const newPasswordSchema = z
  .object({
    password,
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Die Passwörter stimmen nicht überein.',
    path: ['passwordConfirmation'],
  });

export function getDeviceDateFormat(): {
  placeholder: string;
  formatHint: string;
  locale: string;
} {
  try {
    const locale =
      typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().locale : 'de-DE';
    const isUS = locale.startsWith('en-US');

    if (isUS) {
      return {
        locale,
        placeholder: 'MM/DD/YYYY (e.g. 05/15/1990)',
        formatHint: 'MM/DD/YYYY',
      };
    }

    return {
      locale,
      placeholder: 'TT.MM.JJJJ (z.B. 15.05.1990)',
      formatHint: 'TT.MM.JJJJ',
    };
  } catch {
    return {
      locale: 'de-DE',
      placeholder: 'TT.MM.JJJJ (z.B. 15.05.1990)',
      formatHint: 'TT.MM.JJJJ',
    };
  }
}

export function normalizeDateInput(raw: string): string | null {
  const str = raw.trim();
  if (!str) return null;

  // ISO: YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Europa: DD.MM.YYYY
  const deMatch = str.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
  if (deMatch) {
    const [, d, m, y] = deMatch;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // USA: MM/DD/YYYY
  const usMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, m, d, y] = usMatch;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

/** Alle Profilangaben bleiben optional; fehlende Werte werden nicht geraten. */
export const profileSchema = z.object({
  displayName: z.string().trim().min(1, 'Bitte gib einen Namen ein.').max(80).optional(),
  birthDate: z
    .string()
    .transform((val, ctx) => {
      const normalized = normalizeDateInput(val);
      if (!normalized) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Bitte gib ein gültiges Datum ein (z.B. 15.05.1990).',
        });
        return z.NEVER;
      }
      return normalized;
    })
    .refine((value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return false;
      return date <= new Date();
    }, 'Das Geburtsdatum kann nicht in der Zukunft liegen.')
    .optional(),
  // Berechnungsbasis der BMR-Formeln, nicht die Geschlechtsidentitaet.
  sex: z.enum(['male', 'female']).optional(),
  heightCm: z
    .number()
    .positive('Die Größe muss größer als 0 sein.')
    .max(299, 'Bitte gib die Größe in Zentimetern an.')
    .optional(),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).optional(),
  avatarUrl: z.string().nullable().optional(),
});

export type ConfirmationCodeInput = z.infer<typeof confirmationCodeSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;

/** Ordnet jedem Feld seine erste Zod-Fehlermeldung zu. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in result)) result[key] = issue.message;
  }
  return result;
}
