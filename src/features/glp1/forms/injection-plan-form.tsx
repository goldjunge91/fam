import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, TextInput, View } from 'react-native';
import { z } from 'zod';
import { font } from '@/components/theme';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Txt } from '@/constants/ui';
import { formatDateTimeInput } from '@/features/glp1/domain/date-time-input';
import {
  dateTimeInputSchema,
  medicationNameInputSchema,
  positiveDoseInputSchema,
} from '@/features/glp1/domain/form-schema-primitives';
import { MEDICATION_UNITS } from '@/features/glp1/domain/medication-options';

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
  const { colors } = useTheme();
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
  const unit = watch('unit');
  const surfaceStyle = {
    backgroundColor: colors.backgroundElement,
    borderColor: colors.border,
  };
  const inputStyle = {
    color: colors.text,
    backgroundColor: colors.backgroundElement,
    borderColor: colors.border,
    fontSize: font.sizes.md,
    lineHeight: font.lineHeights.subheading,
  };

  return (
    <View className="p-three rounded-xl gap-three border" style={surfaceStyle}>
      <Txt variant="label" weight="700">
        {mode === 'edit' ? 'Injektionsplan bearbeiten' : 'Injektionsplan anlegen'}
      </Txt>

      <View className="gap-one">
        <Txt variant="caption" tone="secondary">
          Medikament:
        </Txt>
        <Controller
          control={control}
          name="medicationName"
          render={({ field: { onChange, value } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              accessibilityLabel="Medikament im Injektionsplan"
              className="p-two rounded-lg border"
              placeholderTextColor={colors.textSecondary}
              style={inputStyle}
            />
          )}
        />
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
                <Txt variant="body" weight="700" tone={isSelected ? 'onAccent' : 'primary'}>
                  {value}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="flex-row gap-two">
        <View className="flex-1 gap-one">
          <Txt variant="caption" tone="secondary">
            Dosis ({unit}):
          </Txt>
          <Controller
            control={control}
            name="dose"
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                accessibilityLabel="Dosis im Injektionsplan"
                keyboardType="decimal-pad"
                className="p-two rounded-lg border"
                placeholderTextColor={colors.textSecondary}
                style={inputStyle}
              />
            )}
          />
          {errors.dose ? (
            <Txt variant="caption" tone="danger">
              {errors.dose.message}
            </Txt>
          ) : null}
        </View>
        <View className="flex-1 gap-one">
          <Txt variant="caption" tone="secondary">
            Alle wie viele Tage:
          </Txt>
          <Controller
            control={control}
            name="cadenceDays"
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                accessibilityLabel="Kadenz in Tagen"
                keyboardType="number-pad"
                className="p-two rounded-lg border"
                placeholderTextColor={colors.textSecondary}
                style={inputStyle}
              />
            )}
          />
          {errors.cadenceDays ? (
            <Txt variant="caption" tone="danger">
              {errors.cadenceDays.message}
            </Txt>
          ) : null}
        </View>
      </View>

      <View className="gap-one">
        <Txt variant="caption" tone="secondary">
          Erster Fälligkeitszeitpunkt:
        </Txt>
        <Controller
          control={control}
          name="anchorAt"
          render={({ field: { onChange, value } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              accessibilityLabel="Ankerzeitpunkt des Injektionsplans"
              placeholder="JJJJ-MM-TT HH:MM"
              autoCapitalize="none"
              className="p-two rounded-lg border"
              placeholderTextColor={colors.textSecondary}
              style={inputStyle}
            />
          )}
        />
        {errors.anchorAt ? (
          <Txt variant="caption" tone="danger">
            {errors.anchorAt.message}
          </Txt>
        ) : null}
      </View>

      <Button
        title={mode === 'edit' ? 'Änderungen speichern' : 'Plan speichern'}
        onPress={() => void handleSubmit((value) => onSubmit(value))()}
        loading={isPending}
      />
    </View>
  );
}
