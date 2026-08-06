import { Button, Column, Host, Spacer, Text } from '@expo/ui';
import { useState } from 'react';
import { Pressable, Text as RNText, StyleSheet, View } from 'react-native';
import { TextField } from '@/components/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useOnboarding } from '../context/onboarding-context';
import type { ActivityLevel, SexOption, WeightGoal } from '../types';

const SEX_OPTIONS: { value: SexOption; label: string }[] = [
  { value: 'male', label: 'Männlich' },
  { value: 'female', label: 'Weiblich' },
];

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sitzend / Kaum Bewegung' },
  { value: 'light', label: 'Leicht aktiv (1–3 Tage Sport)' },
  { value: 'moderate', label: 'Mäßig aktiv (3–5 Tage Sport)' },
  { value: 'active', label: 'Sehr aktiv (Täglicher Sport)' },
];

const GOAL_OPTIONS: { value: WeightGoal; label: string }[] = [
  { value: 'lose', label: 'Gewicht reduzieren' },
  { value: 'maintain', label: 'Gewicht halten' },
  { value: 'gain', label: 'Gewicht / Muskeln aufbauen' },
];

interface ProfileStepFormProps {
  onNext: () => void;
  onSkip: () => void;
}

export function ProfileStepForm({ onNext, onSkip }: ProfileStepFormProps) {
  const theme = useTheme();
  const { state, updateProfileData } = useOnboarding();

  const [displayName, setDisplayName] = useState(state.profile.displayName ?? '');
  const [birthDate, setBirthDate] = useState(state.profile.birthDate ?? '');
  const [heightCm, setHeightCm] = useState(state.profile.heightCm?.toString() ?? '');
  const [weightKg, setWeightKg] = useState(state.profile.weightKg?.toString() ?? '');
  const [sex, setSex] = useState<SexOption | undefined>(state.profile.sex);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | undefined>(
    state.profile.activityLevel,
  );
  const [weightGoal, setWeightGoal] = useState<WeightGoal | undefined>(state.profile.weightGoal);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};

    if (heightCm.trim()) {
      const h = Number(heightCm.replace(',', '.'));
      if (Number.isNaN(h) || h < 50 || h > 250) {
        newErrors.heightCm = 'Bitte eine verlässliche Größe (50–250 cm) eingeben';
      }
    }

    if (weightKg.trim()) {
      const w = Number(weightKg.replace(',', '.'));
      if (Number.isNaN(w) || w < 20 || w > 300) {
        newErrors.weightKg = 'Bitte ein verlässliches Gewicht (20–300 kg) eingeben';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    updateProfileData({
      displayName: displayName.trim() || undefined,
      birthDate: birthDate.trim() || undefined,
      heightCm: heightCm.trim() ? Number(heightCm.replace(',', '.')) : undefined,
      weightKg: weightKg.trim() ? Number(weightKg.replace(',', '.')) : undefined,
      sex,
      activityLevel,
      weightGoal,
    });

    onNext();
  };

  return (
    <Host matchContents>
      <Column style={styles.container}>
        <Text textStyle={{ ...styles.heading, color: theme.text }}>Dein Profil & Körperwerte</Text>
        <Text textStyle={{ ...styles.subheading, color: theme.textSecondary }}>
          Alle Angaben sind freiwillig und dienen der genauen Kalorienberechnung.
        </Text>

        <Spacer size={Spacing.three} />

        <TextField
          label="Rufname / Anzeigename"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Wie möchtest du genannt werden?"
        />

        <Spacer size={Spacing.two} />

        <TextField
          label="Geburtsdatum (JJJJ-MM-TT)"
          value={birthDate}
          onChangeText={setBirthDate}
          placeholder="1990-05-15"
          inputMode="numeric"
        />

        <Spacer size={Spacing.two} />

        <View style={styles.inputRow}>
          <View style={styles.halfInput}>
            <TextField
              label="Größe (cm)"
              value={heightCm}
              onChangeText={setHeightCm}
              placeholder="178"
              inputMode="numeric"
              keyboardType="number-pad"
              error={errors.heightCm}
            />
          </View>
          <View style={styles.halfInput}>
            <TextField
              label="Gewicht (kg)"
              value={weightKg}
              onChangeText={setWeightKg}
              placeholder="75"
              inputMode="numeric"
              keyboardType="number-pad"
              error={errors.weightKg}
            />
          </View>
        </View>

        <Spacer size={Spacing.three} />

        <Text textStyle={{ ...styles.label, color: theme.text }}>
          Berechnungsbasis (Geschlecht)
        </Text>
        <View style={styles.chipRow}>
          {SEX_OPTIONS.map((opt) => {
            const selected = sex === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setSex(selected ? undefined : opt.value)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? theme.accent : theme.backgroundElement,
                    borderColor: selected ? theme.accent : theme.border,
                  },
                ]}>
                <RNText style={{ color: selected ? '#ffffff' : theme.text }}>{opt.label}</RNText>
              </Pressable>
            );
          })}
        </View>

        <Spacer size={Spacing.three} />

        <Text textStyle={{ ...styles.label, color: theme.text }}>Ernährungsziel</Text>
        <View style={styles.chipRow}>
          {GOAL_OPTIONS.map((opt) => {
            const selected = weightGoal === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setWeightGoal(selected ? undefined : opt.value)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? theme.accent : theme.backgroundElement,
                    borderColor: selected ? theme.accent : theme.border,
                  },
                ]}>
                <RNText style={{ color: selected ? '#ffffff' : theme.text }}>{opt.label}</RNText>
              </Pressable>
            );
          })}
        </View>

        <Spacer size={Spacing.three} />

        <Text textStyle={{ ...styles.label, color: theme.text }}>Aktivitätslevel im Alltag</Text>
        <View style={styles.stackChoices}>
          {ACTIVITY_OPTIONS.map((opt) => {
            const selected = activityLevel === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setActivityLevel(selected ? undefined : opt.value)}
                style={[
                  styles.choiceCard,
                  {
                    backgroundColor: selected ? theme.accent : theme.backgroundElement,
                    borderColor: selected ? theme.accent : theme.border,
                  },
                ]}>
                <RNText style={{ color: selected ? '#ffffff' : theme.text }}>{opt.label}</RNText>
              </Pressable>
            );
          })}
        </View>

        <Spacer size={Spacing.four} />

        <View style={styles.buttonRow}>
          <Button onPress={handleSubmit}>Weiter</Button>
          <Spacer size={Spacing.two} />
          <Button onPress={onSkip}>Später ausfüllen</Button>
        </View>
      </Column>
    </Host>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  subheading: {
    fontSize: 14,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  halfInput: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  stackChoices: {
    gap: Spacing.two,
  },
  choiceCard: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
