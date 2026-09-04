import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, TextInput, View } from 'react-native';
import { z } from 'zod';
import { useTheme } from '@/components/theme/ThemeProvider';
import { font } from '@/components/theme';
import { Button } from '@/components/ui/buttons';
import { Txt } from '@/constants/ui';
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
} from '@/features/glp1/domain/medication-options';

const COMMON_MEDICATIONS = ['Semaglutid', 'Tirzepatid', 'Liraglutid'] as const;
const COMMON_DOSES = ['0.25', '0.5', '1.0', '1.7', '2.4'] as const;

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

function isCommonMedication(value: string): boolean {
  return COMMON_MEDICATIONS.some((medication) => medication === value);
}

function isCommonDose(value: string): boolean {
  return COMMON_DOSES.some((dose) => dose === value);
}

export function InjectionForm({
  isPending,
  onSubmit,
  initialValue,
  recentSites = [],
  mode = 'create',
}: InjectionFormProps) {
  const { colors } = useTheme();
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

  const medicationName = watch('medicationName');
  const dose = watch('dose');
  const unit = watch('unit');
  const injectionSite = watch('injectionSite');
  const customMedication = !isCommonMedication(medicationName);
  const customDose = !isCommonDose(dose);
  const surfaceStyle = {
    backgroundColor: colors.backgroundElement,
    borderColor: colors.border,
  };
  const inputStyle = {
    color: colors.text,
    backgroundColor: colors.backgroundElement,
    borderColor: colors.border,
    fontSize: font.sizes.bodyLarge,
    lineHeight: font.lineHeights.bodyLarge,
  };
  const multilineInputStyle = { ...inputStyle, textAlignVertical: 'top' as const };

  return (
    <View className="p-three rounded-xl gap-three border" style={surfaceStyle}>
      <Txt variant="label" weight="700">
        {mode === 'edit' ? 'Injektion bearbeiten' : 'Injektion erfassen'}
      </Txt>

      <View className="gap-one">
        <Txt variant="caption" tone="secondary">
          Medikament auswählen:
        </Txt>
        <View className="flex-row flex-wrap gap-two">
          {[...COMMON_MEDICATIONS, 'Andere'].map((name) => {
            const isSelected = name === 'Andere' ? customMedication : medicationName === name;
            return (
              <Pressable
                key={name}
                onPress={() =>
                  setValue('medicationName', name === 'Andere' ? '' : name, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                style={{
                  backgroundColor: isSelected ? colors.accent : colors.backgroundElement,
                  borderColor: isSelected ? colors.accent : colors.border,
                }}
                className="py-one px-three rounded-xl border">
                <Txt variant="bodyRelaxed" weight="700" tone={isSelected ? 'onAccent' : 'primary'}>
                  {name}
                </Txt>
              </Pressable>
            );
          })}
        </View>
        {customMedication ? (
          <Controller
            control={control}
            name="medicationName"
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                accessibilityLabel="Name des Medikaments"
                placeholder="Name des Medikaments"
                className="p-two rounded-lg border mt-one"
                placeholderTextColor={colors.textSecondary}
                style={inputStyle}
              />
            )}
          />
        ) : null}
        {errors.medicationName ? (
          <Txt variant="caption" tone="danger">
            {errors.medicationName.message}
          </Txt>
        ) : null}
      </View>

      <View className="gap-one">
        <Txt variant="caption" tone="secondary">
          Einheit:
        </Txt>
        <View className="flex-row flex-wrap gap-two">
          {MEDICATION_UNITS.map((value) => {
            const isSelected = unit === value;
            return (
              <Pressable
                key={value}
                onPress={() => setValue('unit', value, { shouldDirty: true, shouldValidate: true })}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                style={{
                  backgroundColor: isSelected ? colors.accent : colors.backgroundElement,
                  borderColor: isSelected ? colors.accent : colors.border,
                }}
                className="py-one px-three rounded-xl border">
                <Txt variant="bodyRelaxed" weight="700" tone={isSelected ? 'onAccent' : 'primary'}>
                  {value}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-one">
        <Txt variant="caption" tone="secondary">
          Dosis ({unit}):
        </Txt>
        <View className="flex-row flex-wrap gap-two">
          {[...COMMON_DOSES, 'Andere'].map((value) => {
            const isSelected = value === 'Andere' ? customDose : dose === value;
            return (
              <Pressable
                key={value}
                onPress={() =>
                  setValue('dose', value === 'Andere' ? '' : value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                style={{
                  backgroundColor: isSelected ? colors.accent : colors.backgroundElement,
                  borderColor: isSelected ? colors.accent : colors.border,
                }}
                className="py-one px-three rounded-xl border">
                <Txt variant="bodyRelaxed" weight="700" tone={isSelected ? 'onAccent' : 'primary'}>
                  {value === 'Andere' ? 'Andere' : `${value} ${unit}`}
                </Txt>
              </Pressable>
            );
          })}
        </View>
        {customDose ? (
          <Controller
            control={control}
            name="dose"
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                accessibilityLabel="Dosis"
                placeholder="z. B. 0.75"
                keyboardType="decimal-pad"
                className="p-two rounded-lg border mt-one"
                placeholderTextColor={colors.textSecondary}
                style={inputStyle}
              />
            )}
          />
        ) : null}
        {errors.dose ? (
          <Txt variant="caption" tone="danger">
            {errors.dose.message}
          </Txt>
        ) : null}
      </View>

      <View className="gap-one">
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
        <View className="flex-row flex-wrap gap-two">
          <Pressable
            onPress={() =>
              setValue('injectionSite', null, { shouldDirty: true, shouldValidate: true })
            }
            accessibilityRole="radio"
            accessibilityState={{ selected: injectionSite === null }}
            style={{
              backgroundColor: injectionSite === null ? colors.accent : colors.backgroundElement,
              borderColor: injectionSite === null ? colors.accent : colors.border,
            }}
            className="py-one px-three rounded-xl border">
            <Txt variant="bodyRelaxed" weight="700" tone={injectionSite === null ? 'onAccent' : 'primary'}>
              Keine Angabe
            </Txt>
          </Pressable>
          {INJECTION_SITES.map(({ value, label }) => {
            const isSelected = injectionSite === value;
            return (
              <Pressable
                key={value}
                onPress={() =>
                  setValue('injectionSite', value, { shouldDirty: true, shouldValidate: true })
                }
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                style={{
                  backgroundColor: isSelected ? colors.accent : colors.backgroundElement,
                  borderColor: isSelected ? colors.accent : colors.border,
                }}
                className="py-one px-three rounded-xl border">
                <Txt variant="bodyRelaxed" weight="700" tone={isSelected ? 'onAccent' : 'primary'}>
                  {label}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-one">
        <Txt variant="caption" tone="secondary">
          Zeitpunkt:
        </Txt>
        <Controller
          control={control}
          name="administeredAt"
          render={({ field: { onChange, value } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              accessibilityLabel="Zeitpunkt der Injektion"
              placeholder="JJJJ-MM-TT HH:MM"
              autoCapitalize="none"
              className="p-two rounded-lg border"
              placeholderTextColor={colors.textSecondary}
              style={inputStyle}
            />
          )}
        />
        {errors.administeredAt ? (
          <Txt variant="caption" tone="danger">
            {errors.administeredAt.message}
          </Txt>
        ) : null}
      </View>

      <View className="gap-one">
        <Txt variant="caption" tone="secondary">
          Notiz:
        </Txt>
        <Controller
          control={control}
          name="notes"
          render={({ field: { onChange, value } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              accessibilityLabel="Notiz zur Injektion"
              placeholder="Optional"
              multiline
              className="p-two rounded-lg border min-h-16"
              placeholderTextColor={colors.textSecondary}
              style={multilineInputStyle}
            />
          )}
        />
        {errors.notes ? (
          <Txt variant="caption" tone="danger">
            {errors.notes.message}
          </Txt>
        ) : null}
      </View>

      <View
        className="p-two rounded-lg border flex-row items-center justify-between"
        style={surfaceStyle}>
        <Txt variant="bodyRelaxed" tone="secondary">
          Ausgewählt:
        </Txt>
        <Txt variant="bodyRelaxed" weight="700">
          {medicationName || '–'} ({dose || '–'} {unit})
        </Txt>
      </View>

      <Button
        label={mode === 'edit' ? 'Änderungen speichern' : 'Injektion speichern'}
        onPress={() => void handleSubmit((value) => onSubmit(value))()}
        loading={isPending}
        style={{ marginTop: 4 }}
      />
    </View>
  );
}
