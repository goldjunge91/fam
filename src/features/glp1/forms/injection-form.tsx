import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { formatDateTimeInput, parseDateTimeInput } from '@/features/glp1/domain/date-time-input';
import { useTheme } from '@/hooks/use-theme';

const COMMON_MEDICATIONS = ['Semaglutid', 'Tirzepatid', 'Liraglutid'];
const COMMON_DOSES = ['0.25', '0.5', '1.0', '1.7', '2.4'];
export const MEDICATION_UNITS = ['mg', 'ml', 'units', 'mcg', 'pills'] as const;
const INJECTION_SITES = [
  { value: 'abdomen', label: 'Bauch' },
  { value: 'thigh', label: 'Oberschenkel' },
  { value: 'upper_arm', label: 'Oberarm' },
  { value: 'other', label: 'Andere Stelle' },
] as const;

export type InjectionSite = (typeof INJECTION_SITES)[number]['value'];
export type MedicationUnit = (typeof MEDICATION_UNITS)[number];

export type InjectionFormValue = {
  medicationName: string;
  dose: number | null;
  unit: MedicationUnit;
  injectionSite: InjectionSite | null;
  administeredAt: string;
  notes: string | null;
};

type InjectionFormProps = {
  isPending: boolean;
  onSubmit: (value: InjectionFormValue) => void;
  initialValue?: InjectionFormValue;
  recentSites?: InjectionSite[];
  mode?: 'create' | 'edit';
};

export function InjectionForm({
  isPending,
  onSubmit,
  initialValue,
  recentSites = [],
  mode = 'create',
}: InjectionFormProps) {
  const theme = useTheme();
  const initialMedication = initialValue?.medicationName ?? 'Semaglutid';
  const initialDose = initialValue?.dose?.toString() ?? '0.5';
  const [medName, setMedName] = useState(
    COMMON_MEDICATIONS.includes(initialMedication) ? initialMedication : 'Andere',
  );
  const [customMed, setCustomMed] = useState(
    COMMON_MEDICATIONS.includes(initialMedication) ? '' : initialMedication,
  );
  const [dose, setDose] = useState(COMMON_DOSES.includes(initialDose) ? initialDose : 'Andere');
  const [customDose, setCustomDose] = useState(
    COMMON_DOSES.includes(initialDose) ? '' : initialDose,
  );
  const [unit, setUnit] = useState<MedicationUnit>(initialValue?.unit ?? 'mg');
  const [injectionSite, setInjectionSite] = useState<InjectionSite | null>(
    initialValue?.injectionSite ?? null,
  );
  const [administeredAt, setAdministeredAt] = useState(() =>
    formatDateTimeInput(initialValue?.administeredAt),
  );
  const [notes, setNotes] = useState(initialValue?.notes ?? '');

  const effectiveMedName = medName === 'Andere' ? customMed : medName;
  const effectiveDose = dose === 'Andere' ? customDose : dose;
  const parsedAdministeredAt = parseDateTimeInput(administeredAt);

  function handleSubmit() {
    if (!effectiveMedName.trim() || !parsedAdministeredAt) return;
    const parsedDose = Number.parseFloat(effectiveDose.replace(',', '.'));
    onSubmit({
      medicationName: effectiveMedName.trim(),
      dose: Number.isNaN(parsedDose) ? null : parsedDose,
      unit,
      injectionSite,
      administeredAt: parsedAdministeredAt,
      notes: notes.trim() || null,
    });
  }

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
            placeholderTextColor={theme.textSecondary}
            style={{ color: theme.text }}
          />
        )}
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
                onPress={() => setUnit(value)}
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
                  {value === 'Andere' ? 'Andere' : `${value} ${unit}`}
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
            placeholderTextColor={theme.textSecondary}
            style={{ color: theme.text }}
          />
        )}
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
            onPress={() => setInjectionSite(null)}
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
                onPress={() => setInjectionSite(value)}
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
        <TextInput
          value={administeredAt}
          onChangeText={setAdministeredAt}
          accessibilityLabel="Zeitpunkt der Injektion"
          placeholder="JJJJ-MM-TT HH:MM"
          autoCapitalize="none"
          className="p-two bg-card rounded-lg border border-border text-sm"
          placeholderTextColor={theme.textSecondary}
          style={{ color: theme.text }}
        />
        {!parsedAdministeredAt ? (
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
          accessibilityLabel="Notiz zur Injektion"
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
          {effectiveMedName || '–'} ({effectiveDose || '–'} {unit})
        </ThemedText>
      </View>

      <Pressable
        onPress={handleSubmit}
        disabled={
          isPending || !effectiveMedName.trim() || !effectiveDose.trim() || !parsedAdministeredAt
        }
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
