import { Host, Switch } from '@expo/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, TextInput, View } from 'react-native';
import { z } from 'zod';
import { ThemedText } from '@/components/theme/themed-text';
import { formatDateTimeInput, parseDateTimeInput } from '@/features/glp1/domain/date-time-input';
import { MEDICATION_UNITS } from '@/features/glp1/domain/medication-options';
import { useTheme } from '@/hooks/use-theme';

const injectionPlanFormSchema = z.object({
  medicationName: z.string().trim().min(1, 'Medikament fehlt').max(200),
  dose: z.string().transform((value, context) => {
    const parsed = Number(value.trim().replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      context.addIssue({ code: 'custom', message: 'Dosis muss größer als 0 sein' });
      return z.NEVER;
    }
    return parsed;
  }),
  unit: z.enum(MEDICATION_UNITS),
  cadenceDays: z.string().transform((value, context) => {
    const parsed = Number(value.trim());
    if (!Number.isInteger(parsed) || parsed <= 0) {
      context.addIssue({ code: 'custom', message: 'Kadenz muss eine positive Tageszahl sein' });
      return z.NEVER;
    }
    return parsed;
  }),
  anchorAt: z.string().transform((value, context) => {
    const parsed = parseDateTimeInput(value);
    if (!parsed) {
      context.addIssue({ code: 'custom', message: 'Bitte als JJJJ-MM-TT HH:MM eingeben' });
      return z.NEVER;
    }
    return parsed;
  }),
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
  const theme = useTheme();
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

  return (
    <View className="p-three bg-surface rounded-xl gap-three border border-border">
      <ThemedText type="labelBold">
        {mode === 'edit' ? 'Injektionsplan bearbeiten' : 'Injektionsplan anlegen'}
      </ThemedText>

      <View className="gap-one">
        <ThemedText type="caption" themeColor="textSecondary">
          Medikament:
        </ThemedText>
        <Controller
          control={control}
          name="medicationName"
          render={({ field: { onChange, value } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              accessibilityLabel="Medikament im Injektionsplan"
              className="p-two bg-card rounded-lg border border-border text-sm"
              placeholderTextColor={theme.textSecondary}
              style={{ color: theme.text }}
            />
          )}
        />
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

      <View className="flex-row gap-two">
        <View className="flex-1 gap-one">
          <ThemedText type="caption" themeColor="textSecondary">
            Dosis ({unit}):
          </ThemedText>
          <Controller
            control={control}
            name="dose"
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                accessibilityLabel="Dosis im Injektionsplan"
                keyboardType="decimal-pad"
                className="p-two bg-card rounded-lg border border-border text-sm"
                placeholderTextColor={theme.textSecondary}
                style={{ color: theme.text }}
              />
            )}
          />
          {errors.dose ? (
            <ThemedText type="caption" themeColor="danger">
              {errors.dose.message}
            </ThemedText>
          ) : null}
        </View>
        <View className="flex-1 gap-one">
          <ThemedText type="caption" themeColor="textSecondary">
            Alle wie viele Tage:
          </ThemedText>
          <Controller
            control={control}
            name="cadenceDays"
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                accessibilityLabel="Kadenz in Tagen"
                keyboardType="number-pad"
                className="p-two bg-card rounded-lg border border-border text-sm"
                placeholderTextColor={theme.textSecondary}
                style={{ color: theme.text }}
              />
            )}
          />
          {errors.cadenceDays ? (
            <ThemedText type="caption" themeColor="danger">
              {errors.cadenceDays.message}
            </ThemedText>
          ) : null}
        </View>
      </View>

      <View className="gap-one">
        <ThemedText type="caption" themeColor="textSecondary">
          Erster Fälligkeitszeitpunkt:
        </ThemedText>
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
              className="p-two bg-card rounded-lg border border-border text-sm"
              placeholderTextColor={theme.textSecondary}
              style={{ color: theme.text }}
            />
          )}
        />
        {errors.anchorAt ? (
          <ThemedText type="caption" themeColor="danger">
            {errors.anchorAt.message}
          </ThemedText>
        ) : null}
      </View>

      <Controller
        control={control}
        name="reminderEnabled"
        render={({ field: { onChange, value } }) => (
          <Host matchContents>
            <Switch
              value={value}
              onValueChange={onChange}
              label="An fällige Injektion erinnern"
              disabled={isPending}
            />
          </Host>
        )}
      />

      <Pressable
        onPress={handleSubmit((value) => onSubmit(value))}
        disabled={isPending}
        style={{ backgroundColor: theme.accent }}
        className="py-three rounded-xl items-center justify-center">
        <ThemedText type="labelBold" themeColor="onAccent">
          {isPending ? 'Speichern...' : mode === 'edit' ? 'Änderungen speichern' : 'Plan speichern'}
        </ThemedText>
      </Pressable>
    </View>
  );
}
