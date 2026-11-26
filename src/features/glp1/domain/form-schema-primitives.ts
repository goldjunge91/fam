import { z } from 'zod';
import { parseDateTimeInput } from '@/features/glp1/domain/date-time-input';
export const GLP1_VALIDATION_KEYS = {
  medicationMissing: 'glp1.validation.medicationMissing',
  medicationTooLong: 'glp1.validation.medicationTooLong',
  dosePositive: 'glp1.validation.dosePositive',
  dateTime: 'glp1.validation.dateTime',
  notesLong: 'glp1.validation.notesLong',
  tooManyEffects: 'glp1.validation.tooManyEffects',
  effectLong: 'glp1.validation.effectLong',
  cadencePositive: 'glp1.validation.cadencePositive',
} as const;

type Glp1ValidationKey = (typeof GLP1_VALIDATION_KEYS)[keyof typeof GLP1_VALIDATION_KEYS];
type Glp1ValidationTranslator = (key: Glp1ValidationKey) => string;

export function translateGlp1ValidationMessage(
  message: string | undefined,
  translate: Glp1ValidationTranslator,
): string | undefined {
  if (!message) return undefined;

  switch (message) {
    case GLP1_VALIDATION_KEYS.medicationMissing:
    case GLP1_VALIDATION_KEYS.medicationTooLong:
    case GLP1_VALIDATION_KEYS.dosePositive:
    case GLP1_VALIDATION_KEYS.dateTime:
    case GLP1_VALIDATION_KEYS.notesLong:
    case GLP1_VALIDATION_KEYS.tooManyEffects:
    case GLP1_VALIDATION_KEYS.effectLong:
    case GLP1_VALIDATION_KEYS.cadencePositive:
      return translate(message);
    default:
      return message;
  }
}

export const medicationNameInputSchema = z
  .string()
  .trim()
  .min(1, GLP1_VALIDATION_KEYS.medicationMissing)
  .max(200, GLP1_VALIDATION_KEYS.medicationTooLong);

export const positiveDoseInputSchema = z.string().transform((value, context) => {
  const parsed = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    context.addIssue({ code: 'custom', message: GLP1_VALIDATION_KEYS.dosePositive });
    return z.NEVER;
  }
  return parsed;
});

export const dateTimeInputSchema = z.string().transform((value, context) => {
  const parsed = parseDateTimeInput(value);
  if (!parsed) {
    context.addIssue({ code: 'custom', message: GLP1_VALIDATION_KEYS.dateTime });
    return z.NEVER;
  }
  return parsed;
});

export const optionalNotesInputSchema = z
  .string()
  .max(2_000, GLP1_VALIDATION_KEYS.notesLong)
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
        message: GLP1_VALIDATION_KEYS.tooManyEffects,
      });
    }
    if (effects.some((effect) => effect.length > 200)) {
      context.addIssue({
        code: 'custom',
        message: GLP1_VALIDATION_KEYS.effectLong,
      });
    }
  })
  .transform(parseSideEffects);
