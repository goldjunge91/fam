import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { z } from 'zod';
import type { SegmentedControlOption } from '@/constants/ui';
import { Button, Card, SegmentedControl, TextField, Txt } from '@/constants/ui';
import { formatDateTimeInput } from '@/features/glp1/domain/date-time-input';
import {
  dateTimeInputSchema,
  GLP1_VALIDATION_KEYS,
  medicationNameInputSchema,
  positiveDoseInputSchema,
  translateGlp1ValidationMessage,
} from '@/features/glp1/domain/form-schema-primitives';
import { MEDICATION_UNITS, type MedicationUnit } from '@/features/glp1/domain/medication-options';
import { useRozeniteRHFDevTools } from '@/lib/optionals/RozeniteDevTools';

const UNIT_OPTIONS: readonly SegmentedControlOption<MedicationUnit>[] = MEDICATION_UNITS.map(
  (value) => ({ value, label: value }),
);

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.space.lg,
  },
  fieldGroup: {
    gap: theme.space.xs,
  },
  row: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  flex: {
    flex: 1,
  },
}));

const injectionPlanFormSchema = z.object({
  medicationName: medicationNameInputSchema,
  dose: positiveDoseInputSchema,
  unit: z.enum(MEDICATION_UNITS),
  cadenceDays: z.string().transform((value, context) => {
    const parsed = Number(value.trim());
    if (!Number.isInteger(parsed) || parsed <= 0) {
      context.addIssue({ code: 'custom', message: GLP1_VALIDATION_KEYS.cadencePositive });
      return z.NEVER;
    }
    return parsed;
  }),
  anchorAt: dateTimeInputSchema,
  reminderEnabled: z.boolean(),
});

export type InjectionPlanFormValue = z.output<typeof injectionPlanFormSchema>;
type InjectionPlanFormInput = z.input<typeof injectionPlanFormSchema>;
type InjectionPlanFormOutput = z.output<typeof injectionPlanFormSchema>;

type InjectionPlanFormProps = {
  initialValue?: InjectionPlanFormValue;
  isPending: boolean;
  mode: 'create' | 'edit';
  onSubmit: (value: InjectionPlanFormValue) => void;
};

export function InjectionPlanForm({
  initialValue,
  isPending,
  mode,
  onSubmit,
}: InjectionPlanFormProps) {
  const { t } = useTranslation();
  const {
    control,
    formState: { errors },
    handleSubmit,
    setValue,
    watch,
  } = useForm<InjectionPlanFormInput, unknown, InjectionPlanFormOutput>({
    resolver: zodResolver(injectionPlanFormSchema),
    defaultValues: {
      medicationName: initialValue?.medicationName ?? 'Semaglutid',
      dose: initialValue?.dose.toString() ?? '0.5',
      unit: initialValue?.unit ?? 'mg',
      cadenceDays: initialValue?.cadenceDays.toString() ?? '7',
      anchorAt: formatDateTimeInput(initialValue?.anchorAt),
      reminderEnabled: initialValue?.reminderEnabled ?? true,
    },
  });
  useRozeniteRHFDevTools({ control, id: 'glp1-injection-plan' });
  const unit = watch('unit');

  return (
    <Card style={styles.form}>
      <Txt variant="label" weight="700">
        {t(mode === 'edit' ? 'glp1.planForm.editTitle' : 'glp1.planForm.createTitle')}
      </Txt>

      <View style={styles.fieldGroup}>
        <Controller
          control={control}
          name="medicationName"
          render={({ field: { onChange, value } }) => (
            <TextField
              value={value}
              onChangeText={onChange}
              label={t('glp1.planForm.medication')}
              accessibilityLabel={t('glp1.planForm.medicationAccessibility')}
              error={translateGlp1ValidationMessage(errors.medicationName?.message, t)}
              size="large"
            />
          )}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Txt variant="caption" tone="secondary">
          {t('glp1.planForm.unit')}
        </Txt>
        <SegmentedControl
          label={t('glp1.planForm.unitAccessibility')}
          options={UNIT_OPTIONS}
          selected={unit}
          onSelect={(value) => setValue('unit', value, { shouldDirty: true, shouldValidate: true })}
          size="compact"
        />
      </View>

      <View style={styles.row}>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="dose"
            render={({ field: { onChange, value } }) => (
              <TextField
                value={value}
                onChangeText={onChange}
                label={t('glp1.planForm.dose', { unit })}
                accessibilityLabel={t('glp1.planForm.doseAccessibility')}
                keyboardType="decimal-pad"
                error={translateGlp1ValidationMessage(errors.dose?.message, t)}
                size="large"
              />
            )}
          />
        </View>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="cadenceDays"
            render={({ field: { onChange, value } }) => (
              <TextField
                value={value}
                onChangeText={onChange}
                label={t('glp1.planForm.cadence')}
                accessibilityLabel={t('glp1.planForm.cadenceAccessibility')}
                keyboardType="number-pad"
                error={translateGlp1ValidationMessage(errors.cadenceDays?.message, t)}
                size="large"
              />
            )}
          />
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Controller
          control={control}
          name="anchorAt"
          render={({ field: { onChange, value } }) => (
            <TextField
              value={value}
              onChangeText={onChange}
              label={t('glp1.planForm.anchor')}
              accessibilityLabel={t('glp1.planForm.anchorAccessibility')}
              placeholder={t('glp1.planForm.placeholder')}
              autoCapitalize="none"
              error={translateGlp1ValidationMessage(errors.anchorAt?.message, t)}
              size="large"
            />
          )}
        />
      </View>

      <Button
        title={t(mode === 'edit' ? 'glp1.planForm.saveChanges' : 'glp1.planForm.save')}
        onPress={() => void handleSubmit((value) => onSubmit(value))()}
        loading={isPending}
      />
    </Card>
  );
}
