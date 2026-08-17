import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { TextField } from '@/components/text-field';
import { Button } from '@/components/ui/buttons';
import { useProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-provider';
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
    <View className="gap-three">
      <Text className="perm-heading">Dein Profil & Körperwerte</Text>
      <Text className="perm-subheading">
        Alle Angaben sind freiwillig und dienen der genauen Kalorienberechnung.
      </Text>

      <View className="profile-form-section">
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

        <View className="input-row">
          <View className="flex-1">
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
          <View className="flex-1">
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

        <Text className="section-label">Berechnungsbasis (Geschlecht)</Text>
        <View className="sex-row">
          {SEX_OPTIONS.map((opt) => {
            const selected = sex === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setSex(selected ? undefined : opt.value)}
                className={`option-button ${selected ? 'selectable-selected' : 'selectable-idle'}`}>
                <Text className={`option-text ${selected ? 'text-on-accent' : 'text-text'}`}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text className="section-label">Ernährungsziel</Text>
        <View className="gap-two">
          {GOAL_OPTIONS.map((opt) => {
            const selected = weightGoal === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setWeightGoal(selected ? undefined : opt.value)}
                className={`profile-choice-card ${selected ? 'selectable-selected' : 'selectable-idle'}`}>
                <Text
                  className={`profile-choice-text ${selected ? 'text-on-accent' : 'text-text'}`}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text className="section-label">Aktivitätslevel im Alltag</Text>
        <View className="gap-two">
          {ACTIVITY_OPTIONS.map((opt) => {
            const selected = activityLevel === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setActivityLevel(selected ? undefined : opt.value)}
                className={`profile-choice-card ${selected ? 'selectable-selected' : 'selectable-idle'}`}>
                <Text
                  className={`profile-choice-text ${selected ? 'text-on-accent' : 'text-text'}`}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="perm-button-row">
        <View className="flex-1">
          <Button label="Weiter" onPress={handleSubmit} />
        </View>
        <View className="flex-1">
          <Button label="Später ausfüllen" variant="secondary" onPress={onSkip} />
        </View>
      </View>
    </View>
  );
}
