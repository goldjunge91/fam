import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, TextInput, View } from 'react-native';
import { z } from 'zod';
import { ThemedText } from '@/components/theme/themed-text';
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
import { useTheme } from '@/hooks/use-theme';

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
  const theme = useTheme();
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

  return (
    <View className="p-three bg-surface rounded-xl gap-three border border-border">
      <ThemedText type="labelBold">
        {mode === 'edit' ? 'Injektion bearbeiten' : 'Injektion erfassen'}
      </ThemedText>

      <View className="gap-one">
        <ThemedText type="caption" themeColor="textSecondary">
          Medikament auswählen:
        </ThemedText>
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
                  backgroundColor: isSelected ? theme.accent : theme.backgroundElement,
                  borderColor: isSelected ? theme.accent : theme.border,
                }}
                className="py-one px-three rounded-xl border">
                <ThemedText type="smallBold" themeColor={isSelected ? 'onAccent' : 'text'}>
                  {name}
                </ThemedText>
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
                className="p-two bg-card rounded-lg border border-border text-sm mt-one"
                placeholderTextColor={theme.textSecondary}
                style={{ color: theme.text }}
              />
            )}
          />
        ) : null}
        {errors.medicationName ? (
          <ThemedText type="caption" themeColor="danger">
            {errors.medicationName.message}
          </ThemedText>
        ) : null}
      </View>

      <View className="gap-one">
        <ThemedText type="caption" themeColor="textSecondary">
          Einheit:
        </ThemedText>
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
                  backgroundColor: isSelected ? theme.accent : theme.backgroundElement,
                  borderColor: isSelected ? theme.accent : theme.border,
                }}
                className="py-one px-three rounded-xl border">
                <ThemedText type="smallBold" themeColor={isSelected ? 'onAccent' : 'text'}>
                  {value}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-one">
        <ThemedText type="caption" themeColor="textSecondary">
          Dosis ({unit}):
        </ThemedText>
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
                  backgroundColor: isSelected ? theme.accent : theme.backgroundElement,
                  borderColor: isSelected ? theme.accent : theme.border,
                }}
                className="py-one px-three rounded-xl border">
                <ThemedText type="smallBold" themeColor={isSelected ? 'onAccent' : 'text'}>
                  {value === 'Andere' ? 'Andere' : `${value} ${unit}`}
                </ThemedText>
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
                className="p-two bg-card rounded-lg border border-border text-sm mt-one"
                placeholderTextColor={theme.textSecondary}
                style={{ color: theme.text }}
              />
            )}
          />
        ) : null}
        {errors.dose ? (
          <ThemedText type="caption" themeColor="danger">
            {errors.dose.message}
          </ThemedText>
        ) : null}
      </View>

      <View className="gap-one">
        <ThemedText type="caption" themeColor="textSecondary">
          Injektionsstelle:
        </ThemedText>
        {recentSites.length > 0 ? (
          <ThemedText type="caption" themeColor="textSecondary">
            Zuletzt:{' '}
            {recentSites
              .map((site) => INJECTION_SITES.find((item) => item.value === site)?.label)
              .join(' · ')}
          </ThemedText>
        ) : null}
        <View className="flex-row flex-wrap gap-two">
          <Pressable
            onPress={() =>
              setValue('injectionSite', null, { shouldDirty: true, shouldValidate: true })
            }
            accessibilityRole="radio"
            accessibilityState={{ selected: injectionSite === null }}
            style={{
              backgroundColor: injectionSite === null ? theme.accent : theme.backgroundElement,
              borderColor: injectionSite === null ? theme.accent : theme.border,
            }}
            className="py-one px-three rounded-xl border">
            <ThemedText type="smallBold" themeColor={injectionSite === null ? 'onAccent' : 'text'}>
              Keine Angabe
            </ThemedText>
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
                  backgroundColor: isSelected ? theme.accent : theme.backgroundElement,
                  borderColor: isSelected ? theme.accent : theme.border,
                }}
                className="py-one px-three rounded-xl border">
                <ThemedText type="smallBold" themeColor={isSelected ? 'onAccent' : 'text'}>
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-one">
        <ThemedText type="caption" themeColor="textSecondary">
          Zeitpunkt:
        </ThemedText>
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
              className="p-two bg-card rounded-lg border border-border text-sm"
              placeholderTextColor={theme.textSecondary}
              style={{ color: theme.text }}
            />
          )}
        />
        {errors.administeredAt ? (
          <ThemedText type="caption" themeColor="danger">
            {errors.administeredAt.message}
          </ThemedText>
        ) : null}
      </View>

      <View className="gap-one">
        <ThemedText type="caption" themeColor="textSecondary">
          Notiz:
        </ThemedText>
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
              className="p-two bg-card rounded-lg border border-border text-sm min-h-16"
              placeholderTextColor={theme.textSecondary}
              style={{ color: theme.text, textAlignVertical: 'top' }}
            />
          )}
        />
        {errors.notes ? (
          <ThemedText type="caption" themeColor="danger">
            {errors.notes.message}
          </ThemedText>
        ) : null}
      </View>

      <View className="p-two rounded-lg bg-card border border-border flex-row items-center justify-between">
        <ThemedText type="small" themeColor="textSecondary">
          Ausgewählt:
        </ThemedText>
        <ThemedText type="smallBold">
          {medicationName || '–'} ({dose || '–'} {unit})
        </ThemedText>
      </View>

      <Pressable
        onPress={handleSubmit((value) => onSubmit(value))}
        disabled={isPending}
        style={{ backgroundColor: theme.accent }}
        className="py-three rounded-xl items-center justify-center mt-one">
        <ThemedText type="labelBold" themeColor="onAccent">
          {isPending
            ? 'Speichern...'
            : mode === 'edit'
              ? 'Änderungen speichern'
              : 'Injektion speichern'}
        </ThemedText>
      </Pressable>
    </View>
  );
}
