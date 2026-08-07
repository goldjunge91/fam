import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { getDeviceDateFormat } from '@/features/auth/auth-schemas';
import { useTheme } from '@/hooks/use-theme';

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Kaum Bewegung' },
  { value: 'light', label: 'Leicht aktiv' },
  { value: 'moderate', label: 'Mäßig aktiv' },
  { value: 'active', label: 'Aktiv' },
  { value: 'very_active', label: 'Sehr aktiv' },
] as const;

const SEX_OPTIONS = [
  { value: 'male', label: 'Männlich' },
  { value: 'female', label: 'Weiblich' },
] as const;

function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.choices}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(selected ? undefined : option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[
              styles.choice,
              {
                backgroundColor: selected ? theme.accent : theme.backgroundElement,
                borderColor: selected ? theme.accent : theme.border,
              },
            ]}>
            <ThemedText type="small" style={selected ? styles.choiceSelected : undefined}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StepProfile({
  displayName,
  setDisplayName,
  birthDate,
  setBirthDate,
  heightCm,
  setHeightCm,
  sex,
  setSex,
  activityLevel,
  setActivityLevel,
  profileErrors,
}: {
  displayName: string;
  setDisplayName: (v: string) => void;
  birthDate: string;
  setBirthDate: (v: string) => void;
  heightCm: string;
  setHeightCm: (v: string) => void;
  sex: 'male' | 'female' | undefined;
  setSex: (v: 'male' | 'female' | undefined) => void;
  activityLevel: (typeof ACTIVITY_LEVELS)[number]['value'] | undefined;
  setActivityLevel: (v: (typeof ACTIVITY_LEVELS)[number]['value'] | undefined) => void;
  profileErrors: Record<string, string>;
}) {
  return (
    <>
      <Card title="Schritt 6: Dein Profil (Optional)">
        <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.two }}>
          Diese Angaben dienen zur Schätzung deines Kalorienbedarfs. Du kannst sie jederzeit in den
          Einstellungen ändern.
        </ThemedText>
        <View style={styles.form}>
          <TextField
            label="Name"
            value={displayName}
            onChangeText={setDisplayName}
            error={profileErrors.displayName}
            autoCapitalize="words"
            placeholder="Wie sollen dich andere sehen?"
          />
          <TextField
            label="Geburtsdatum"
            value={birthDate}
            onChangeText={setBirthDate}
            error={profileErrors.birthDate}
            placeholder={getDeviceDateFormat().placeholder}
            autoCapitalize="none"
          />
          <TextField
            label="Größe in cm"
            value={heightCm}
            onChangeText={setHeightCm}
            error={profileErrors.heightCm}
            placeholder="178"
            autoCapitalize="none"
          />
        </View>
      </Card>

      <Card title="Berechnungsbasis">
        <ChoiceRow options={SEX_OPTIONS} value={sex} onChange={setSex} />
      </Card>

      <Card title="Aktivitätslevel">
        <ChoiceRow options={ACTIVITY_LEVELS} value={activityLevel} onChange={setActivityLevel} />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  choice: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  choiceSelected: {
    color: '#ffffff',
  },
});
