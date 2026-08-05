import { z } from 'zod';

/**
 * Eingabevalidierung fuer die Auth-Formulare.
 *
 * Reine Schemas ohne I/O — dadurch ohne Testdoubles pruefbar. Sie ersetzen
 * keine serverseitige Pruefung: Supabase validiert erneut, und RLS entscheidet
 * ohnehin unabhaengig davon, was der Client schickt.
 */

const email = z
  .string()
  .trim()
  // Adressen werden haeufig mit Grossbuchstaben eingegeben; Supabase behandelt
  // sie case-insensitiv, aber ein konsistenter Wert vermeidet Verwirrung in der
  // Anzeige und beim Vergleich.
  .toLowerCase()
  .min(1, 'Bitte gib deine E-Mail-Adresse ein.')
  .email('Das sieht nicht wie eine E-Mail-Adresse aus.');

/**
 * Supabase lehnt Passwoerter unter 6 Zeichen serverseitig ab. Wir fordern 8 —
 * die Fehlermeldung kommt dann sofort und nicht erst nach einem Roundtrip.
 *
 * Bewusst keine Zeichenklassen-Pflicht ("mindestens eine Ziffer, ein
 * Sonderzeichen"): Solche Regeln erzeugen erwiesenermassen vorhersagbare
 * Passwoerter wie "Passwort1!" statt sicherer. Laenge ist der wirksamere Hebel.
 */
const password = z
  .string()
  .min(8, 'Das Passwort braucht mindestens 8 Zeichen.')
  .max(72, 'Das Passwort darf höchstens 72 Zeichen haben.');

export const signInSchema = z.object({
  email,
  // Beim Login nur auf "nicht leer" pruefen. Wer sein altes, kuerzeres Passwort
  // eingibt, soll die Meldung vom Server bekommen ("falsche Zugangsdaten") und
  // nicht faelschlich hoeren, sein Passwort sei zu kurz.
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

export const newPasswordSchema = z
  .object({
    password,
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Die Passwörter stimmen nicht überein.',
    path: ['passwordConfirmation'],
  });

/**
 * Profil-Onboarding (#57). Alle Felder sind optional — die App muss mit einem
 * unvollstaendigen Profil funktionieren und meldet ein fehlendes Kalorienziel
 * spaeter ehrlich als "nicht berechenbar", statt zu raten.
 */
export const profileSchema = z.object({
  displayName: z.string().trim().min(1, 'Bitte gib einen Namen ein.').max(80).optional(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Bitte im Format JJJJ-MM-TT.')
    .refine((value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return false;
      // Ein Geburtsdatum in der Zukunft ist ein Tippfehler, kein Sonderfall.
      return date <= new Date();
    }, 'Das Geburtsdatum kann nicht in der Zukunft liegen.')
    .optional(),
  // Berechnungsbasis der BMR-Formeln, nicht die Geschlechtsidentitaet — siehe
  // Kommentar auf public.profiles.sex.
  sex: z.enum(['male', 'female']).optional(),
  heightCm: z
    .number()
    .positive('Die Größe muss größer als 0 sein.')
    .max(299, 'Bitte gib die Größe in Zentimetern an.')
    .optional(),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).optional(),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;

/**
 * Wandelt einen Zod-Fehler in eine Zuordnung Feldname -> Meldung.
 *
 * Formulare zeigen Fehler pro Feld an, nicht als Sammelmeldung am Seitenende —
 * dort ist nicht erkennbar, welche Eingabe gemeint ist.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    // Erste Meldung je Feld gewinnt: Mehrere gleichzeitig sind fuer den Nutzer
    // nicht hilfreicher, nur laenger.
    if (!(key in result)) result[key] = issue.message;
  }
  return result;
}
