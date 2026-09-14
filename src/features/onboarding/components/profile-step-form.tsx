import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button, Press, TextField, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { useProfile } from '@/features/profile/api';
import { useFeatureAccess } from '@/features/settings/use-feature-access';
import {
  type OnboardingProfileForm,
  type OnboardingProfileFormInput,
  onboardingProfileFormSchema,
} from '@/lib/db/zod/onboarding.zod';
import { useRozeniteRHFDevTools } from '@/lib/optionals/RozeniteDevTools';
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

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.space.lg,
  },
  formSection: {
    gap: theme.space.lg,
    marginTop: theme.space.xs,
  },
  inputRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  flex: {
    flex: 1,
  },
  sectionLabel: {
    marginTop: theme.space.sm,
  },
  sexRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  sexButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: theme.borderWidth.base,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space.lg,
  },
  choiceList: {
    gap: theme.space.sm,
  },
  choice: {
    paddingVertical: 10,
    paddingHorizontal: theme.space.lg,
    borderWidth: theme.borderWidth.base,
    borderRadius: theme.radius.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
    marginTop: theme.space.lg,
  },
}));

export function ProfileStepForm({ onNext, onSkip }: ProfileStepFormProps) {
  const { state, updateProfileData } = useOnboarding();
  const { session } = useSession();
  const { data: userProfile } = useProfile(session?.user.id);
  const { isFeatureEnabled } = useFeatureAccess();
  const caloriesTrackingEnabled = isFeatureEnabled('calories');

  const {
    control,
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
  useRozeniteRHFDevTools({ control, id: 'onboarding-profile' });
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
    <View style={styles.root}>
      <Txt variant="subheading" weight="700">
        Dein Profil
      </Txt>
      <Txt variant="body" tone="secondary">
        {caloriesTrackingEnabled
          ? 'Alle Angaben sind freiwillig und dienen der genauen Kalorienberechnung.'
          : 'Dein Anzeigename hilft dir, dich in der App wiederzuerkennen.'}
      </Txt>

      <View style={styles.formSection}>
        <TextField
          label="Rufname / Anzeigename"
          value={displayName}
          onChangeText={(value) => setValue('displayName', value, { shouldValidate: true })}
          placeholder="Wie möchtest du genannt werden?"
        />

        {caloriesTrackingEnabled ? (
          <>
            <Txt variant="body" weight="700" style={styles.sectionLabel}>
              Körper &amp; Aktivität
            </Txt>

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

            <View style={styles.inputRow}>
              <View style={styles.flex}>
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
              <View style={styles.flex}>
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

            <Txt variant="body" weight="600" style={styles.sectionLabel}>
              Berechnungsbasis (Geschlecht)
            </Txt>
            <View
              style={styles.sexRow}
              accessibilityRole="radiogroup"
              accessibilityLabel="Geschlecht">
              {SEX_OPTIONS.map((opt) => {
                const selected = sex === opt.value;
                return (
                  <Press
                    key={opt.value}
                    onPress={() => setValue('sex', selected ? undefined : opt.value)}
                    accessibilityRole="radio"
                    accessibilityLabel={opt.label}
                    accessibilityState={{ selected }}
                    haptic="selection"
                    containerStyle={styles.flex}
                    selected={selected}
                    style={styles.sexButton}>
                    <Txt variant="body" tone="primary" weight="600">
                      {opt.label}
                    </Txt>
                  </Press>
                );
              })}
            </View>

            <Txt variant="body" weight="600" style={styles.sectionLabel}>
              Ernährungsziel
            </Txt>
            <View
              style={styles.choiceList}
              accessibilityRole="radiogroup"
              accessibilityLabel="Ernährungsziel">
              {GOAL_OPTIONS.map((opt) => {
                const selected = weightGoal === opt.value;
                return (
                  <Press
                    key={opt.value}
                    onPress={() => setValue('weightGoal', selected ? undefined : opt.value)}
                    accessibilityRole="radio"
                    accessibilityLabel={opt.label}
                    accessibilityState={{ selected }}
                    haptic="selection"
                    selected={selected}
                    style={styles.choice}>
                    <Txt variant="body" tone="primary" weight="500">
                      {opt.label}
                    </Txt>
                  </Press>
                );
              })}
            </View>

            <Txt variant="body" weight="600" style={styles.sectionLabel}>
              Aktivitätslevel im Alltag
            </Txt>
            <View
              style={styles.choiceList}
              accessibilityRole="radiogroup"
              accessibilityLabel="Aktivitätslevel im Alltag">
              {ACTIVITY_OPTIONS.map((opt) => {
                const selected = activityLevel === opt.value;
                return (
                  <Press
                    key={opt.value}
                    onPress={() => setValue('activityLevel', selected ? undefined : opt.value)}
                    accessibilityRole="radio"
                    accessibilityLabel={opt.label}
                    accessibilityState={{ selected }}
                    haptic="selection"
                    selected={selected}
                    style={styles.choice}>
                    <Txt variant="body" tone="primary" weight="500">
                      {opt.label}
                    </Txt>
                  </Press>
                );
              })}
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.buttonRow}>
        <View style={styles.flex}>
          <Button title="Weiter" onPress={() => void handleSubmit(submit)()} />
        </View>
        <View style={styles.flex}>
          <Button title="Später ausfüllen" variant="secondary" onPress={onSkip} />
        </View>
      </View>
    </View>
  );
}
