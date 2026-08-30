import { z } from 'zod';
import { parseDateTimeInput } from '@/features/glp1/domain/date-time-input';

export const medicationNameInputSchema = z.string().trim().min(1, 'Medikament fehlt').max(200);

export const positiveDoseInputSchema = z.string().transform((value, context) => {
  const parsed = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    context.addIssue({ code: 'custom', message: 'Dosis muss größer als 0 sein' });
    return z.NEVER;
  }
  return parsed;
});

export const dateTimeInputSchema = z.string().transform((value, context) => {
  const parsed = parseDateTimeInput(value);
  if (!parsed) {
    context.addIssue({ code: 'custom', message: 'Bitte als JJJJ-MM-TT HH:MM eingeben' });
    return z.NEVER;
  }
  return parsed;
});

export const optionalNotesInputSchema = z
  .string()
  .max(2_000, 'Notiz ist zu lang')
  .transform((value) => value.trim() || null);

function parseSideEffects(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const sideEffectsInputSchema = z
  .string()
  .superRefine((value, context) => {
    const effects = parseSideEffects(value);
    if (effects.length > 100) {
      context.addIssue({
        code: 'too_big',
        maximum: 100,
        origin: 'array',
        message: 'Zu viele Nebenwirkungen',
      });
    }
    if (effects.some((effect) => effect.length > 200)) {
      context.addIssue({
        code: 'custom',
        message: 'Eine Nebenwirkung darf höchstens 200 Zeichen lang sein',
      });
    }
  })
  .transform(parseSideEffects);
