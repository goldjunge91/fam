import { z } from 'zod';
import { INJECTION_SITE_VALUES, MEDICATION_UNITS } from '@/features/glp1/domain/medication-options';

const accountIdSchema = z.string().trim().min(1);
const optionalChildProfileIdSchema = z.string().trim().min(1).nullish();
const optionalTimestampSchema = z.iso.datetime({ offset: true }).optional();
const optionalNotesSchema = z
  .string()
  .max(2_000)
  .nullish()
  .transform((value) => value?.trim() || null);

export const medicationLogMutationSchema = z.object({
  userId: accountIdSchema,
  childProfileId: optionalChildProfileIdSchema,
  medicationName: z.string().trim().min(1).max(200),
  dose: z.number().positive().nullable().optional(),
  unit: z.enum(MEDICATION_UNITS).optional().default('mg'),
  injectionSite: z.enum(INJECTION_SITE_VALUES).nullable().optional(),
  administeredAt: optionalTimestampSchema,
  notes: optionalNotesSchema,
});

export const updateMedicationLogMutationSchema = medicationLogMutationSchema.extend({
  id: z.string().trim().min(1),
});

export const symptomLogMutationSchema = z.object({
  userId: accountIdSchema,
  childProfileId: optionalChildProfileIdSchema,
  loggedAt: optionalTimestampSchema,
  appetiteLevel: z.number().int().min(1).max(5).nullable().optional(),
  satietyLevel: z.number().int().min(1).max(5).nullable().optional(),
  nauseaLevel: z.number().int().min(0).max(5).nullable().optional(),
  sideEffects: z.array(z.string().trim().min(1).max(200)).max(100).optional().default([]),
  notes: optionalNotesSchema,
});

export const updateSymptomLogMutationSchema = symptomLogMutationSchema.extend({
  id: z.string().trim().min(1),
});

export const injectionPlanMutationSchema = z.object({
  userId: accountIdSchema,
  medicationName: z.string().trim().min(1).max(200),
  dose: z.number().positive(),
  unit: z.enum(MEDICATION_UNITS),
  cadenceDays: z.number().int().positive(),
  anchorAt: z.iso.datetime({ offset: true }),
  reminderEnabled: z.boolean(),
});

export const updateInjectionPlanMutationSchema = injectionPlanMutationSchema.extend({
  id: z.string().trim().min(1),
});

export const deleteInjectionPlanMutationSchema = z.object({
  id: z.string().trim().min(1),
  userId: accountIdSchema,
});

export type CreateMedicationLogInput = z.input<typeof medicationLogMutationSchema>;
export type UpdateMedicationLogInput = z.input<typeof updateMedicationLogMutationSchema>;
export type CreateSymptomLogInput = z.input<typeof symptomLogMutationSchema>;
export type UpdateSymptomLogInput = z.input<typeof updateSymptomLogMutationSchema>;
export type InjectionPlanInput = z.input<typeof injectionPlanMutationSchema>;
export type DeleteInjectionPlanInput = z.input<typeof deleteInjectionPlanMutationSchema>;
