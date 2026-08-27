import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/buttons';
import { useProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-provider';
import {
  type OnboardingProfileForm,
  type OnboardingProfileFormInput,
  onboardingProfileFormSchema,
} from '@/lib/db/zod/onboarding.zod';
import { formatGermanDateInput, isoDateToGerman } from '../onboarding-helpers';
import { useOnboarding } from '../onboarding-store';
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

  const {
    setValue,
    watch,
    reset,
    getValues,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingProfileFormInput, unknown, OnboardingProfileForm>({
    resolver: zodResolver(onboardingProfileFormSchema),
    defaultValues: {
      displayName: state.profile.displayName ?? '',
      birthDate: state.profile.birthDate ? isoDateToGerman(state.profile.birthDate) : '',
      heightCm: state.profile.heightCm?.toString() ?? '',
      weightKg: state.profile.weightKg?.toString() ?? '',
      sex: state.profile.sex,
      activityLevel: state.profile.activityLevel,
      weightGoal: state.profile.weightGoal,
    },
  });
  const { displayName, birthDate, heightCm, weightKg, sex, activityLevel, weightGoal } = watch();

  useEffect(() => {
    if (userProfile) {
      const current = getValues();
      reset({
        displayName: current.displayName || userProfile.display_name || '',
        birthDate:
          current.birthDate ||
          (userProfile.birth_date ? isoDateToGerman(userProfile.birth_date) : ''),
        heightCm: current.heightCm || (userProfile.height_cm ? String(userProfile.height_cm) : ''),
        weightKg: current.weightKg,
        sex: current.sex || (userProfile.sex as SexOption | null) || undefined,
        activityLevel:
          current.activityLevel ||
          (userProfile.activity_level as ActivityLevel | null) ||
          undefined,
        weightGoal: current.weightGoal,
      });
    }
  }, [getValues, reset, userProfile]);

  const submit = (values: OnboardingProfileForm) => {
    updateProfileData(values);

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
          onChangeText={(value) => setValue('displayName', value, { shouldValidate: true })}
          placeholder="Wie möchtest du genannt werden?"
        />

        <TextField
          label="Geburtsdatum (TT.MM.JJJJ)"
          value={birthDate}
          onChangeText={(text) =>
            setValue('birthDate', formatGermanDateInput(text), { shouldValidate: true })
          }
          placeholder="15.05.1990"
          inputMode="numeric"
          keyboardType="number-pad"
          maxLength={10}
          error={errors.birthDate?.message}
        />

        <View className="input-row">
          <View className="flex-1">
            <TextField
              label="Größe (cm)"
              value={heightCm}
              onChangeText={(value) => setValue('heightCm', value, { shouldValidate: true })}
              placeholder="178"
              inputMode="numeric"
              keyboardType="number-pad"
              error={errors.heightCm?.message}
            />
          </View>
          <View className="flex-1">
            <TextField
              label="Gewicht (kg)"
              value={weightKg}
              onChangeText={(value) => setValue('weightKg', value, { shouldValidate: true })}
              placeholder="75"
              inputMode="numeric"
              keyboardType="number-pad"
              error={errors.weightKg?.message}
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
                onPress={() => setValue('sex', selected ? undefined : opt.value)}
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
                onPress={() => setValue('weightGoal', selected ? undefined : opt.value)}
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
                onPress={() => setValue('activityLevel', selected ? undefined : opt.value)}
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
          <Button label="Weiter" onPress={() => void handleSubmit(submit)()} />
        </View>
        <View className="flex-1">
          <Button label="Später ausfüllen" variant="secondary" onPress={onSkip} />
        </View>
      </View>
    </View>
  );
}
