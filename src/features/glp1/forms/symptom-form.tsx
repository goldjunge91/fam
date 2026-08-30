import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { useTheme } from '@/hooks/use-theme';

export type SymptomFormValue = {
  appetiteLevel: number;
  satietyLevel: number;
  nauseaLevel: number;
};

type SymptomFormProps = {
  isPending: boolean;
  onSubmit: (value: SymptomFormValue) => void;
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

export function SymptomForm({ isPending, onSubmit }: SymptomFormProps) {
  const theme = useTheme();
  const [appetite, setAppetite] = useState(2);
  const [satiety, setSatiety] = useState(4);
  const [nausea, setNausea] = useState(0);

  return (
    <View className="p-three bg-surface rounded-xl gap-three border border-border">
      <ThemedText type="labelBold">Symptom- & Sättigungs-Verlauf</ThemedText>

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

      <View className="p-two rounded-lg bg-card border border-border flex-row items-center justify-between">
        <ThemedText type="small" themeColor="textSecondary">
          Ausgewählt:
        </ThemedText>
        <ThemedText type="smallBold">
          Appetit {appetite}/5 · Sättigung {satiety}/5 · Übelkeit {nausea}/5
        </ThemedText>
      </View>

      <Pressable
        onPress={() =>
          onSubmit({ appetiteLevel: appetite, satietyLevel: satiety, nauseaLevel: nausea })
        }
        disabled={isPending}
        style={{ backgroundColor: theme.accent }}
        className="py-three rounded-xl items-center justify-center mt-one">
        <ThemedText type="labelBold" themeColor="onAccent">
          {isPending ? 'Speichern...' : 'Status speichern'}
        </ThemedText>
      </Pressable>
    </View>
  );
}
