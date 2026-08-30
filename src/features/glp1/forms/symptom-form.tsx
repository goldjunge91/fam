import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, TextInput, View } from 'react-native';
import { z } from 'zod';
import { ThemedText } from '@/components/theme/themed-text';
import { formatDateTimeInput, parseDateTimeInput } from '@/features/glp1/domain/date-time-input';
import { useTheme } from '@/hooks/use-theme';

const symptomFormSchema = z.object({
  appetiteLevel: z.number().int().min(1).max(5),
  satietyLevel: z.number().int().min(1).max(5),
  nauseaLevel: z.number().int().min(0).max(5),
  sideEffects: z.string().transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  ),
  loggedAt: z.string().transform((value, context) => {
    const parsed = parseDateTimeInput(value);
    if (!parsed) {
      context.addIssue({ code: 'custom', message: 'Bitte als JJJJ-MM-TT HH:MM eingeben' });
      return z.NEVER;
    }
    return parsed;
  }),
  notes: z
    .string()
    .max(2_000, 'Notiz ist zu lang')
    .transform((value) => value.trim() || null),
});

export type SymptomFormValue = z.output<typeof symptomFormSchema>;
type SymptomFormInput = z.input<typeof symptomFormSchema>;
type SymptomFormOutput = z.output<typeof symptomFormSchema>;

type SymptomFormProps = {
  isPending: boolean;
  onSubmit: (value: SymptomFormValue) => void;
  initialValue?: SymptomFormValue;
  mode?: 'create' | 'edit';
};

type LevelPickerProps = {
  label: string;
  levels: number[];
  selected: number;
  onSelect: (value: number) => void;
};

function LevelPicker({ label, levels, selected, onSelect }: LevelPickerProps) {
  const theme = useTheme();
  return (
    <View className="gap-one">
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View className="flex-row gap-two justify-between">
        {levels.map((level) => {
          const isSelected = selected === level;
          return (
            <Pressable
              key={level}
              onPress={() => onSelect(level)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              style={{
                backgroundColor: isSelected ? theme.accent : theme.backgroundElement,
                borderColor: isSelected ? theme.accent : theme.border,
              }}
              className="flex-1 h-9 rounded-xl items-center justify-center border">
              <ThemedText type="labelBold" themeColor={isSelected ? 'onAccent' : 'text'}>
                {level}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function SymptomForm({
  isPending,
  onSubmit,
  initialValue,
  mode = 'create',
}: SymptomFormProps) {
  const theme = useTheme();
  const {
    control,
    formState: { errors },
    handleSubmit,
    setValue,
    watch,
  } = useForm<SymptomFormInput, unknown, SymptomFormOutput>({
    resolver: zodResolver(symptomFormSchema),
    defaultValues: {
      appetiteLevel: initialValue?.appetiteLevel ?? 2,
      satietyLevel: initialValue?.satietyLevel ?? 4,
      nauseaLevel: initialValue?.nauseaLevel ?? 0,
      sideEffects: initialValue?.sideEffects.join(', ') ?? '',
      loggedAt: formatDateTimeInput(initialValue?.loggedAt),
      notes: initialValue?.notes ?? '',
    },
  });

  const appetite = watch('appetiteLevel');
  const satiety = watch('satietyLevel');
  const nausea = watch('nauseaLevel');

  return (
    <View className="p-three bg-surface rounded-xl gap-three border border-border">
      <ThemedText type="labelBold">
        {mode === 'edit' ? 'Symptome bearbeiten' : 'Symptom- & Sättigungs-Verlauf'}
      </ThemedText>

      <LevelPicker
        label="Appetit (1 = kein Appetit, 5 = starker Heißhunger):"
        levels={[1, 2, 3, 4, 5]}
        selected={appetite}
        onSelect={(value) =>
          setValue('appetiteLevel', value, { shouldDirty: true, shouldValidate: true })
        }
      />
      <LevelPicker
        label="Sättigungsgefühl (1 = kaum satt, 5 = sehr schnell satt):"
        levels={[1, 2, 3, 4, 5]}
        selected={satiety}
        onSelect={(value) =>
          setValue('satietyLevel', value, { shouldDirty: true, shouldValidate: true })
        }
      />
      <LevelPicker
        label="Übelkeit / Nebenwirkung (0 = keine, 5 = stark):"
        levels={[0, 1, 2, 3, 4, 5]}
        selected={nausea}
        onSelect={(value) =>
          setValue('nauseaLevel', value, { shouldDirty: true, shouldValidate: true })
        }
      />

      <View className="gap-one">
        <ThemedText type="caption" themeColor="textSecondary">
          Konkrete Nebenwirkungen:
        </ThemedText>
        <Controller
          control={control}
          name="sideEffects"
          render={({ field: { onChange, value } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              accessibilityLabel="Konkrete Nebenwirkungen"
              placeholder="z. B. Kopfschmerz, Müdigkeit"
              className="p-two bg-card rounded-lg border border-border text-sm"
              placeholderTextColor={theme.textSecondary}
              style={{ color: theme.text }}
            />
          )}
        />
      </View>

      <View className="gap-one">
        <ThemedText type="caption" themeColor="textSecondary">
          Zeitpunkt:
        </ThemedText>
        <Controller
          control={control}
          name="loggedAt"
          render={({ field: { onChange, value } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              accessibilityLabel="Zeitpunkt der Symptome"
              placeholder="JJJJ-MM-TT HH:MM"
              autoCapitalize="none"
              className="p-two bg-card rounded-lg border border-border text-sm"
              placeholderTextColor={theme.textSecondary}
              style={{ color: theme.text }}
            />
          )}
        />
        {errors.loggedAt ? (
          <ThemedText type="caption" themeColor="danger">
            {errors.loggedAt.message}
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
              accessibilityLabel="Notiz zu den Symptomen"
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
          Appetit {appetite}/5 · Sättigung {satiety}/5 · Übelkeit {nausea}/5
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
              : 'Status speichern'}
        </ThemedText>
      </Pressable>
    </View>
  );
}
