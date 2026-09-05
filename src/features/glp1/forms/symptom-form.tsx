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
  optionalNotesInputSchema,
  sideEffectsInputSchema,
} from '@/features/glp1/domain/form-schema-primitives';

const symptomFormSchema = z.object({
  appetiteLevel: z.number().int().min(1).max(5),
  satietyLevel: z.number().int().min(1).max(5),
  nauseaLevel: z.number().int().min(0).max(5),
  sideEffects: sideEffectsInputSchema,
  loggedAt: dateTimeInputSchema,
  notes: optionalNotesInputSchema,
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
  const { colors } = useTheme();
  return (
    <View className="gap-one">
      <Txt variant="caption" tone="secondary">
        {label}
      </Txt>
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
                backgroundColor: isSelected ? colors.accent : colors.backgroundElement,
                borderColor: isSelected ? colors.accent : colors.border,
              }}
              className="flex-1 h-9 rounded-xl items-center justify-center border">
              <Txt variant="label" weight="700" tone={isSelected ? 'onAccent' : 'primary'}>
                {level}
              </Txt>
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
  const { colors } = useTheme();
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
  const multilineInputStyle = { ...inputStyle, textAlignVertical: 'top' as const };

  return (
    <View className="p-three rounded-xl gap-three border" style={surfaceStyle}>
      <Txt variant="label" weight="700">
        {mode === 'edit' ? 'Symptome bearbeiten' : 'Symptom- & Sättigungs-Verlauf'}
      </Txt>

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
        <Txt variant="caption" tone="secondary">
          Konkrete Nebenwirkungen:
        </Txt>
        <Controller
          control={control}
          name="sideEffects"
          render={({ field: { onChange, value } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              accessibilityLabel="Konkrete Nebenwirkungen"
              placeholder="z. B. Kopfschmerz, Müdigkeit"
              className="p-two rounded-lg border"
              placeholderTextColor={colors.textSecondary}
              style={inputStyle}
            />
          )}
        />
        {errors.sideEffects ? (
          <Txt variant="caption" tone="danger">
            {errors.sideEffects.message}
          </Txt>
        ) : null}
      </View>

      <View className="gap-one">
        <Txt variant="caption" tone="secondary">
          Zeitpunkt:
        </Txt>
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
              className="p-two rounded-lg border"
              placeholderTextColor={colors.textSecondary}
              style={inputStyle}
            />
          )}
        />
        {errors.loggedAt ? (
          <Txt variant="caption" tone="danger">
            {errors.loggedAt.message}
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
              accessibilityLabel="Notiz zu den Symptomen"
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
        <Txt variant="body" tone="secondary">
          Ausgewählt:
        </Txt>
        <Txt variant="body" weight="700">
          Appetit {appetite}/5 · Sättigung {satiety}/5 · Übelkeit {nausea}/5
        </Txt>
      </View>

      <Button
        title={mode === 'edit' ? 'Änderungen speichern' : 'Status speichern'}
        onPress={() => void handleSubmit((value) => onSubmit(value))()}
        loading={isPending}
        style={{ marginTop: 4 }}
      />
    </View>
  );
}
