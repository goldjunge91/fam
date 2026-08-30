import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { useTheme } from '@/hooks/use-theme';

const COMMON_MEDICATIONS = ['Semaglutid', 'Tirzepatid', 'Liraglutid'];
const COMMON_DOSES = ['0.25', '0.5', '1.0', '1.7', '2.4'];

export type InjectionFormValue = {
  medicationName: string;
  dose: number | null;
  unit: string;
};

type InjectionFormProps = {
  isPending: boolean;
  onSubmit: (value: InjectionFormValue) => void;
};

export function InjectionForm({ isPending, onSubmit }: InjectionFormProps) {
  const theme = useTheme();
  const [medName, setMedName] = useState('Semaglutid');
  const [customMed, setCustomMed] = useState('');
  const [dose, setDose] = useState('0.5');
  const [customDose, setCustomDose] = useState('');
  const unit = 'mg';

  const effectiveMedName = medName === 'Andere' ? customMed : medName;
  const effectiveDose = dose === 'Andere' ? customDose : dose;

  function handleSubmit() {
    if (!effectiveMedName.trim()) return;
    const parsedDose = Number.parseFloat(effectiveDose.replace(',', '.'));
    onSubmit({
      medicationName: effectiveMedName.trim(),
      dose: Number.isNaN(parsedDose) ? null : parsedDose,
      unit,
    });
  }

  return (
    <View className="p-three bg-surface rounded-xl gap-three border border-border">
      <ThemedText type="labelBold">Injektion erfassen</ThemedText>

      <View className="gap-one">
        <ThemedText type="caption" themeColor="textSecondary">
          Medikament auswählen:
        </ThemedText>
        <View className="flex-row flex-wrap gap-two">
          {[...COMMON_MEDICATIONS, 'Andere'].map((name) => {
            const isSelected = medName === name;
            return (
              <Pressable
                key={name}
                onPress={() => setMedName(name)}
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
        {medName === 'Andere' && (
          <TextInput
            value={customMed}
            onChangeText={setCustomMed}
            placeholder="Name des Medikaments"
            className="p-two bg-card rounded-lg border border-border text-sm mt-one"
            placeholderTextColor="#888"
          />
        )}
      </View>

      <View className="gap-one">
        <ThemedText type="caption" themeColor="textSecondary">
          Dosis (mg):
        </ThemedText>
        <View className="flex-row flex-wrap gap-two">
          {[...COMMON_DOSES, 'Andere'].map((value) => {
            const isSelected = dose === value;
            return (
              <Pressable
                key={value}
                onPress={() => setDose(value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                style={{
                  backgroundColor: isSelected ? theme.accent : theme.backgroundElement,
                  borderColor: isSelected ? theme.accent : theme.border,
                }}
                className="py-one px-three rounded-xl border">
                <ThemedText type="smallBold" themeColor={isSelected ? 'onAccent' : 'text'}>
                  {value === 'Andere' ? 'Andere' : `${value} mg`}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        {dose === 'Andere' && (
          <TextInput
            value={customDose}
            onChangeText={setCustomDose}
            placeholder="z. B. 0.75"
            keyboardType="decimal-pad"
            className="p-two bg-card rounded-lg border border-border text-sm mt-one"
            placeholderTextColor="#888"
          />
        )}
      </View>

      <View className="p-two rounded-lg bg-card border border-border flex-row items-center justify-between">
        <ThemedText type="small" themeColor="textSecondary">
          Ausgewählt:
        </ThemedText>
        <ThemedText type="smallBold">
          {effectiveMedName || '–'} ({effectiveDose || '–'} mg)
        </ThemedText>
      </View>

      <Pressable
        onPress={handleSubmit}
        disabled={isPending || !effectiveMedName.trim() || !effectiveDose.trim()}
        style={{ backgroundColor: theme.accent }}
        className="py-three rounded-xl items-center justify-center mt-one">
        <ThemedText type="labelBold" themeColor="onAccent">
          {isPending ? 'Speichern...' : 'Injektion speichern'}
        </ThemedText>
      </Pressable>
    </View>
  );
}
