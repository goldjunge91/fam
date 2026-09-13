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
  optionalNotesInputSchema,
  positiveDoseInputSchema,
} from '@/features/glp1/domain/form-schema-primitives';
import {
  INJECTION_SITE_VALUES,
  INJECTION_SITES,
  type InjectionSite,
  MEDICATION_UNITS,
  type MedicationUnit,
} from '@/features/glp1/domain/medication-options';
import { useRozeniteRHFDevTools } from '@/lib/optionals/RozeniteDevTools';

const COMMON_MEDICATIONS = ['Semaglutid', 'Tirzepatid', 'Liraglutid'] as const;
const COMMON_DOSES = ['0.25', '0.5', '1.0', '1.7', '2.4'] as const;
const CUSTOM_SELECTION = 'custom' as const;

type MedicationSelection = (typeof COMMON_MEDICATIONS)[number] | typeof CUSTOM_SELECTION;
type DoseSelection = (typeof COMMON_DOSES)[number] | typeof CUSTOM_SELECTION;
type InjectionSiteSelection = InjectionSite | 'none';

const MEDICATION_OPTIONS: readonly SegmentedControlOption<MedicationSelection>[] = [
  { value: 'Semaglutid', label: 'Semaglutid' },
  { value: 'Tirzepatid', label: 'Tirzepatid' },
  { value: 'Liraglutid', label: 'Liraglutid' },
  { value: CUSTOM_SELECTION, label: 'Andere' },
];

const UNIT_OPTIONS: readonly SegmentedControlOption<MedicationUnit>[] = MEDICATION_UNITS.map(
  (value) => ({ value, label: value }),
);

const INJECTION_SITE_OPTIONS: readonly SegmentedControlOption<InjectionSiteSelection>[] = [
  { value: 'none', label: 'Keine Angabe' },
  ...INJECTION_SITES,
];

const injectionFormSchema = z.object({
  medicationName: medicationNameInputSchema,
  dose: positiveDoseInputSchema,
  unit: z.enum(MEDICATION_UNITS),
  injectionSite: z.enum(INJECTION_SITE_VALUES).nullable(),
  administeredAt: dateTimeInputSchema,
  notes: optionalNotesInputSchema,
});

export type InjectionFormValue = z.output<typeof injectionFormSchema>;
type InjectionFormInput = z.input<typeof injectionFormSchema>;
type InjectionFormOutput = z.output<typeof injectionFormSchema>;

type InjectionFormProps = {
  isPending: boolean;
  onSubmit: (value: InjectionFormValue) => void;
  initialValue?: InjectionFormValue;
  recentSites?: InjectionSite[];
  mode?: 'create' | 'edit';
};

function isCommonMedication(value: string): value is (typeof COMMON_MEDICATIONS)[number] {
  return COMMON_MEDICATIONS.some((medication) => medication === value);
}

function isCommonDose(value: string): value is (typeof COMMON_DOSES)[number] {
  return COMMON_DOSES.some((dose) => dose === value);
}

function doseOptions(unit: MedicationUnit): readonly SegmentedControlOption<DoseSelection>[] {
  return [
    ...COMMON_DOSES.map((value) => ({ value, label: `${value} ${unit}` })),
    { value: CUSTOM_SELECTION, label: 'Andere' },
  ];
}

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.space.lg,
  },
  fieldGroup: {
    gap: theme.space.xs,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
    padding: theme.space.sm,
  },
  multilineInput: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  submit: {
    marginTop: theme.space.xs,
  },
}));

export function InjectionForm({
  isPending,
  onSubmit,
  initialValue,
  recentSites = [],
  mode = 'create',
}: InjectionFormProps) {
  const {
    control,
    formState: { errors },
    handleSubmit,
    setValue,
    watch,
  } = useForm<InjectionFormInput, unknown, InjectionFormOutput>({
    resolver: zodResolver(injectionFormSchema),
    defaultValues: {
      medicationName: initialValue?.medicationName ?? 'Semaglutid',
      dose: initialValue?.dose.toString() ?? '0.5',
      unit: initialValue?.unit ?? 'mg',
      injectionSite: initialValue?.injectionSite ?? null,
      administeredAt: formatDateTimeInput(initialValue?.administeredAt),
      notes: initialValue?.notes ?? '',
    },
  });
  useRozeniteRHFDevTools({ control, id: 'glp1-injection' });

  const medicationName = watch('medicationName');
  const dose = watch('dose');
  const unit = watch('unit');
  const injectionSite = watch('injectionSite');
  const medicationSelection = isCommonMedication(medicationName)
    ? medicationName
    : CUSTOM_SELECTION;
  const doseSelection = isCommonDose(dose) ? dose : CUSTOM_SELECTION;
  const injectionSiteSelection = injectionSite ?? 'none';

  return (
    <Card elevation="none" style={styles.form}>
      <Txt variant="label" weight="700">
        {mode === 'edit' ? 'Injektion bearbeiten' : 'Injektion erfassen'}
      </Txt>

      <View style={styles.fieldGroup}>
        <Txt variant="caption" tone="secondary">
          Medikament auswählen:
        </Txt>
        <SegmentedControl
          label="Medikament auswählen"
          options={MEDICATION_OPTIONS}
          selected={medicationSelection}
          onSelect={(value) =>
            setValue('medicationName', value === CUSTOM_SELECTION ? '' : value, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          size="compact"
        />
        {medicationSelection === CUSTOM_SELECTION ? (
          <Controller
            control={control}
            name="medicationName"
            render={({ field: { onChange, value } }) => (
              <TextField
                value={value}
                onChangeText={onChange}
                accessibilityLabel="Name des Medikaments"
                placeholder="Name des Medikaments"
                error={errors.medicationName?.message}
                size="large"
              />
            )}
          />
        ) : null}
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

      <View style={styles.fieldGroup}>
        <Txt variant="caption" tone="secondary">
          Dosis ({unit}):
        </Txt>
        <SegmentedControl
          label={`Dosis in ${unit}`}
          options={doseOptions(unit)}
          selected={doseSelection}
          onSelect={(value) =>
            setValue('dose', value === CUSTOM_SELECTION ? '' : value, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          size="compact"
        />
        {doseSelection === CUSTOM_SELECTION ? (
          <Controller
            control={control}
            name="dose"
            render={({ field: { onChange, value } }) => (
              <TextField
                value={value}
                onChangeText={onChange}
                accessibilityLabel="Dosis"
                placeholder="z. B. 0.75"
                keyboardType="decimal-pad"
                error={errors.dose?.message}
                size="large"
              />
            )}
          />
        ) : null}
      </View>

      <View style={styles.fieldGroup}>
        <Txt variant="caption" tone="secondary">
          Injektionsstelle:
        </Txt>
        {recentSites.length > 0 ? (
          <Txt variant="caption" tone="secondary">
            Zuletzt:{' '}
            {recentSites
              .map((site) => INJECTION_SITES.find((item) => item.value === site)?.label)
              .join(' · ')}
          </Txt>
        ) : null}
        <SegmentedControl
          label="Injektionsstelle"
          options={INJECTION_SITE_OPTIONS}
          selected={injectionSiteSelection}
          onSelect={(value) =>
            setValue('injectionSite', value === 'none' ? null : value, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          size="compact"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Controller
          control={control}
          name="administeredAt"
          render={({ field: { onChange, value } }) => (
            <TextField
              value={value}
              onChangeText={onChange}
              label="Zeitpunkt:"
              accessibilityLabel="Zeitpunkt der Injektion"
              placeholder="JJJJ-MM-TT HH:MM"
              autoCapitalize="none"
              error={errors.administeredAt?.message}
              size="large"
            />
          )}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Controller
          control={control}
          name="notes"
          render={({ field: { onChange, value } }) => (
            <TextField
              value={value}
              onChangeText={onChange}
              label="Notiz:"
              accessibilityLabel="Notiz zur Injektion"
              placeholder="Optional"
              multiline
              error={errors.notes?.message}
              size="large"
              style={styles.multilineInput}
            />
          )}
        />
      </View>

      <Card padded={false} elevation="none" style={styles.summary}>
        <Txt variant="body" tone="secondary">
          Ausgewählt:
        </Txt>
        <Txt variant="body" weight="700">
          {medicationName || '–'} ({dose || '–'} {unit})
        </Txt>
      </Card>

      <Button
        title={mode === 'edit' ? 'Änderungen speichern' : 'Injektion speichern'}
        onPress={() => void handleSubmit((value) => onSubmit(value))()}
        loading={isPending}
        style={styles.submit}
      />
    </Card>
  );
}
