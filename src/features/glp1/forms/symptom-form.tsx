import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { z } from 'zod';
import { Button, Card, SegmentedControl, TextField, Txt } from '@/constants/ui';
import { formatDateTimeInput } from '@/features/glp1/domain/date-time-input';
import {
  dateTimeInputSchema,
  optionalNotesInputSchema,
  sideEffectsInputSchema,
} from '@/features/glp1/domain/form-schema-primitives';
import { useRozeniteRHFDevTools } from '@/lib/optionals/RozeniteDevTools';

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.space.lg,
  },
  levelPicker: {
    gap: theme.space.xs,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
    padding: theme.space.sm,
  },
  fieldGroup: {
    gap: theme.space.xs,
  },
  multilineInput: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  submit: {
    marginTop: theme.space.xs,
  },
}));

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
  return (
    <View style={styles.levelPicker}>
      <Txt variant="caption" tone="secondary">
        {label}
      </Txt>
      <SegmentedControl
        label={label}
        options={levels.map((level) => ({ value: String(level), label: String(level) }))}
        selected={String(selected)}
        onSelect={(value) => onSelect(Number(value))}
        size="compact"
      />
    </View>
  );
}

export function SymptomForm({
  isPending,
  onSubmit,
  initialValue,
  mode = 'create',
}: SymptomFormProps) {
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
  useRozeniteRHFDevTools({ control, id: 'glp1-symptom' });

  const appetite = watch('appetiteLevel');
  const satiety = watch('satietyLevel');
  const nausea = watch('nauseaLevel');

  return (
    <Card elevation="none" style={styles.form}>
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

      <View style={styles.fieldGroup}>
        <Controller
          control={control}
          name="sideEffects"
          render={({ field: { onChange, value } }) => (
            <TextField
              value={value}
              onChangeText={onChange}
              label="Konkrete Nebenwirkungen:"
              accessibilityLabel="Konkrete Nebenwirkungen"
              placeholder="z. B. Kopfschmerz, Müdigkeit"
              error={errors.sideEffects?.message}
              size="large"
            />
          )}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Controller
          control={control}
          name="loggedAt"
          render={({ field: { onChange, value } }) => (
            <TextField
              value={value}
              onChangeText={onChange}
              label="Zeitpunkt:"
              accessibilityLabel="Zeitpunkt der Symptome"
              placeholder="JJJJ-MM-TT HH:MM"
              autoCapitalize="none"
              error={errors.loggedAt?.message}
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
              accessibilityLabel="Notiz zu den Symptomen"
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
          Appetit {appetite}/5 · Sättigung {satiety}/5 · Übelkeit {nausea}/5
        </Txt>
      </Card>

      <Button
        title={mode === 'edit' ? 'Änderungen speichern' : 'Status speichern'}
        onPress={() => void handleSubmit((value) => onSubmit(value))()}
        loading={isPending}
        style={styles.submit}
      />
    </Card>
  );
}
