import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { formatDateTimeInput, parseDateTimeInput } from '@/features/glp1/domain/date-time-input';
import { useTheme } from '@/hooks/use-theme';

export type SymptomFormValue = {
  appetiteLevel: number;
  satietyLevel: number;
  nauseaLevel: number;
  sideEffects: string[];
  loggedAt: string;
  notes: string | null;
};

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
  const [appetite, setAppetite] = useState(initialValue?.appetiteLevel ?? 2);
  const [satiety, setSatiety] = useState(initialValue?.satietyLevel ?? 4);
  const [nausea, setNausea] = useState(initialValue?.nauseaLevel ?? 0);
  const [sideEffects, setSideEffects] = useState(initialValue?.sideEffects.join(', ') ?? '');
  const [loggedAt, setLoggedAt] = useState(() => formatDateTimeInput(initialValue?.loggedAt));
  const [notes, setNotes] = useState(initialValue?.notes ?? '');
  const parsedLoggedAt = parseDateTimeInput(loggedAt);

  function handleSubmit() {
    if (!parsedLoggedAt) return;
    onSubmit({
      appetiteLevel: appetite,
      satietyLevel: satiety,
      nauseaLevel: nausea,
      sideEffects: sideEffects
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      loggedAt: parsedLoggedAt,
      notes: notes.trim() || null,
    });
  }

  return (
    <View className="p-three bg-surface rounded-xl gap-three border border-border">
      <ThemedText type="labelBold">
        {mode === 'edit' ? 'Symptome bearbeiten' : 'Symptom- & Sättigungs-Verlauf'}
      </ThemedText>

      <LevelPicker
        label="Appetit (1 = kein Appetit, 5 = starker Heißhunger):"
        levels={[1, 2, 3, 4, 5]}
        selected={appetite}
        onSelect={setAppetite}
      />
      <LevelPicker
        label="Sättigungsgefühl (1 = kaum satt, 5 = sehr schnell satt):"
        levels={[1, 2, 3, 4, 5]}
        selected={satiety}
        onSelect={setSatiety}
      />
      <LevelPicker
        label="Übelkeit / Nebenwirkung (0 = keine, 5 = stark):"
        levels={[0, 1, 2, 3, 4, 5]}
        selected={nausea}
        onSelect={setNausea}
      />

      <View className="gap-one">
        <ThemedText type="caption" themeColor="textSecondary">
          Konkrete Nebenwirkungen:
        </ThemedText>
        <TextInput
          value={sideEffects}
          onChangeText={setSideEffects}
          accessibilityLabel="Konkrete Nebenwirkungen"
          placeholder="z. B. Kopfschmerz, Müdigkeit"
          className="p-two bg-card rounded-lg border border-border text-sm"
          placeholderTextColor={theme.textSecondary}
          style={{ color: theme.text }}
        />
      </View>

      <View className="gap-one">
        <ThemedText type="caption" themeColor="textSecondary">
          Zeitpunkt:
        </ThemedText>
        <TextInput
          value={loggedAt}
          onChangeText={setLoggedAt}
          accessibilityLabel="Zeitpunkt der Symptome"
          placeholder="JJJJ-MM-TT HH:MM"
          autoCapitalize="none"
          className="p-two bg-card rounded-lg border border-border text-sm"
          placeholderTextColor={theme.textSecondary}
          style={{ color: theme.text }}
        />
        {!parsedLoggedAt ? (
          <ThemedText type="caption" themeColor="danger">
            Bitte als JJJJ-MM-TT HH:MM eingeben.
          </ThemedText>
        ) : null}
      </View>

      <View className="gap-one">
        <ThemedText type="caption" themeColor="textSecondary">
          Notiz:
        </ThemedText>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          accessibilityLabel="Notiz zu den Symptomen"
          placeholder="Optional"
          multiline
          className="p-two bg-card rounded-lg border border-border text-sm min-h-16"
          placeholderTextColor={theme.textSecondary}
          style={{ color: theme.text, textAlignVertical: 'top' }}
        />
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
        onPress={handleSubmit}
        disabled={isPending || !parsedLoggedAt}
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
