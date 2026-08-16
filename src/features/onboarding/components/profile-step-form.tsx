import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TextField } from '@/components/text-field';
import { FontSize } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { Radius, Spacing } from '@/constants/theme';
import { useProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-provider';
import { useTheme } from '@/hooks/use-theme';
import { useOnboarding } from '../context/onboarding-context';
import { validateOnboardingProfile } from '../onboarding-helpers';
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
  const { session } = useSession();
  const { data: userProfile } = useProfile(session?.user.id);

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

  useEffect(() => {
    if (userProfile) {
      if (userProfile.display_name) {
        setDisplayName((prev) => prev || userProfile.display_name || '');
      }
      if (userProfile.birth_date) {
        setBirthDate((prev) => prev || userProfile.birth_date || '');
      }
      if (userProfile.height_cm) {
        setHeightCm((prev) => prev || String(userProfile.height_cm));
      }
      if (userProfile.sex) {
        setSex((prev) => prev || (userProfile.sex as SexOption));
      }
      if (userProfile.activity_level) {
        setActivityLevel((prev) => prev || (userProfile.activity_level as ActivityLevel));
      }
    }
  }, [userProfile]);

  const handleSubmit = () => {
    const parsedHeight = heightCm.trim() ? Number(heightCm.replace(',', '.')) : undefined;
    const parsedWeight = weightKg.trim() ? Number(weightKg.replace(',', '.')) : undefined;

    const validation = validateOnboardingProfile({
      heightCm: parsedHeight,
      weightKg: parsedWeight,
      birthDate: birthDate.trim() || undefined,
    });

    if (!validation.isValid) {
      const newErrors: Record<string, string> = {};
      if (parsedHeight !== undefined && (parsedHeight < 50 || parsedHeight > 250)) {
        newErrors.heightCm = 'Bitte eine verlässliche Größe (50–250 cm) eingeben';
      }
      if (parsedWeight !== undefined && (parsedWeight < 20 || parsedWeight > 300)) {
        newErrors.weightKg = 'Bitte ein verlässliches Gewicht (20–300 kg) eingeben';
      }
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
    <View style={styles.container}>
      <Text style={[styles.heading, { color: theme.text }]}>Dein Profil & Körperwerte</Text>
      <Text style={[styles.subheading, { color: theme.textSecondary }]}>
        Alle Angaben sind freiwillig und dienen der genauen Kalorienberechnung.
      </Text>

      <View style={styles.formSection}>
        <TextField
          label="Rufname / Anzeigename"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Wie möchtest du genannt werden?"
        />

        <TextField
          label="Geburtsdatum (JJJJ-MM-TT)"
          value={birthDate}
          onChangeText={setBirthDate}
          placeholder="1990-05-15"
          inputMode="numeric"
        />

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

        <Text style={[styles.sectionLabel, { color: theme.text }]}>
          Berechnungsbasis (Geschlecht)
        </Text>
        <View style={styles.sexRow}>
          {SEX_OPTIONS.map((opt) => {
            const selected = sex === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setSex(selected ? undefined : opt.value)}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: selected ? theme.accent : theme.backgroundElement,
                    borderColor: selected ? theme.accent : theme.border,
                  },
                ]}>
                <Text style={[styles.optionText, { color: selected ? '#ffffff' : theme.text }]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.text }]}>Ernährungsziel</Text>
        <View style={styles.goalStack}>
          {GOAL_OPTIONS.map((opt) => {
            const selected = weightGoal === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setWeightGoal(selected ? undefined : opt.value)}
                style={[
                  styles.choiceCard,
                  {
                    backgroundColor: selected ? theme.accent : theme.backgroundElement,
                    borderColor: selected ? theme.accent : theme.border,
                  },
                ]}>
                <Text style={[styles.choiceText, { color: selected ? '#ffffff' : theme.text }]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.text }]}>Aktivitätslevel im Alltag</Text>
        <View style={styles.activityStack}>
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
                <Text style={[styles.choiceText, { color: selected ? '#ffffff' : theme.text }]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.buttonRow}>
        <View style={styles.buttonCol}>
          <Button label="Weiter" onPress={handleSubmit} />
        </View>
        <View style={styles.buttonCol}>
          <Button label="Später ausfüllen" variant="secondary" onPress={onSkip} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  heading: {
    ...FontSize[22],
    fontWeight: '700',
  },
  subheading: {
    ...FontSize[14],
    lineHeight: 20,
  },
  formSection: {
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  halfInput: {
    flex: 1,
  },
  sectionLabel: {
    ...FontSize[14],
    fontWeight: '600',
    marginTop: Spacing.two,
  },
  sexRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  optionButton: {
    flex: 1,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    ...FontSize[14],
    fontWeight: '600',
  },
  goalStack: {
    gap: Spacing.two,
  },
  activityStack: {
    gap: Spacing.two,
  },
  choiceCard: {
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  choiceText: {
    ...FontSize[14],
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  buttonCol: {
    flex: 1,
  },
});
