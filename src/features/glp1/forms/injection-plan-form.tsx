import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { z } from 'zod';
import type { SegmentedControlOption } from '@/constants/ui';
import { Button, Card, SegmentedControl, TextField, Txt } from '@/constants/ui';
import { formatDateTimeInput } from '@/features/glp1/domain/date-time-input';
import {
  dateTimeInputSchema,
  medicationNameInputSchema,
  positiveDoseInputSchema,
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
      context.addIssue({ code: 'custom', message: 'Kadenz muss eine positive Tageszahl sein' });
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
        {mode === 'edit' ? 'Injektionsplan bearbeiten' : 'Injektionsplan anlegen'}
      </Txt>

      <View style={styles.fieldGroup}>
        <Controller
          control={control}
          name="medicationName"
          render={({ field: { onChange, value } }) => (
            <TextField
              value={value}
              onChangeText={onChange}
              label="Medikament:"
              accessibilityLabel="Medikament im Injektionsplan"
              error={errors.medicationName?.message}
              size="large"
            />
          )}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Txt variant="caption" tone="secondary">
          Einheit:
        </Txt>
        <SegmentedControl
          label="Einheit"
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
                label={`Dosis (${unit}):`}
                accessibilityLabel="Dosis im Injektionsplan"
                keyboardType="decimal-pad"
                error={errors.dose?.message}
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
                label="Alle wie viele Tage:"
                accessibilityLabel="Kadenz in Tagen"
                keyboardType="number-pad"
                error={errors.cadenceDays?.message}
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
              label="Erster Fälligkeitszeitpunkt:"
              accessibilityLabel="Ankerzeitpunkt des Injektionsplans"
              placeholder="JJJJ-MM-TT HH:MM"
              autoCapitalize="none"
              error={errors.anchorAt?.message}
              size="large"
            />
          )}
        />
      </View>

      <Button
        title={mode === 'edit' ? 'Änderungen speichern' : 'Plan speichern'}
        onPress={() => void handleSubmit((value) => onSubmit(value))()}
        loading={isPending}
      />
    </Card>
  );
}
