import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button, Press, TextField, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { useProfile } from '@/features/profile/api';
import { useFeatureAccess } from '@/features/settings/use-feature-access';
import {
  createOnboardingProfileFormSchema,
  type OnboardingProfileForm,
  type OnboardingProfileFormInput,
} from '@/lib/db/zod/onboarding.zod';
import { useRozeniteRHFDevTools } from '@/lib/optionals/RozeniteDevTools';
import { dateInputOrderForLanguage, formatDateInput, isoDateToInput } from '../onboarding-helpers';
import { useOnboarding } from '../onboarding-store';
import type { ActivityLevel, SexOption } from '../types';

const SEX_OPTIONS = [
  { value: 'male', labelKey: 'onboarding.profile.sex.male' },
  { value: 'female', labelKey: 'onboarding.profile.sex.female' },
] as const;

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', labelKey: 'onboarding.profile.activity.sedentary' },
  { value: 'light', labelKey: 'onboarding.profile.activity.light' },
  { value: 'moderate', labelKey: 'onboarding.profile.activity.moderate' },
  { value: 'active', labelKey: 'onboarding.profile.activity.active' },
] as const;

const GOAL_OPTIONS = [
  { value: 'lose', labelKey: 'onboarding.profile.goals.lose' },
  { value: 'maintain', labelKey: 'onboarding.profile.goals.maintain' },
  { value: 'gain', labelKey: 'onboarding.profile.goals.gain' },
] as const;

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
    paddingVertical: theme.space.md,
    borderWidth: theme.borderWidth.base,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space.lg,
  },
  choiceList: {
    gap: theme.space.sm,
  },
  choice: {
    paddingVertical: theme.space.md,
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
  const { t, i18n } = useTranslation();
  const dateInputOrder = dateInputOrderForLanguage(i18n.language);
  const formSchema = useMemo(
    () => createOnboardingProfileFormSchema(dateInputOrder),
    [dateInputOrder],
  );
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
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: state.profile.displayName ?? '',
      birthDate: state.profile.birthDate
        ? isoDateToInput(state.profile.birthDate, dateInputOrder)
        : '',
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
          (userProfile.birth_date ? isoDateToInput(userProfile.birth_date, dateInputOrder) : ''),
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
  }, [dateInputOrder, getValues, reset, userProfile]);

  const submit = (values: OnboardingProfileForm) => {
    updateProfileData(values);

    onNext();
  };

  return (
    <View style={styles.root}>
      <Txt variant="subheading" weight="700">
        {t('onboarding.profile.heading')}
      </Txt>
      <Txt variant="body" tone="secondary">
        {caloriesTrackingEnabled
          ? t('onboarding.profile.descriptionCalories')
          : t('onboarding.profile.descriptionName')}
      </Txt>

      <View style={styles.formSection}>
        <TextField
          label={t('onboarding.profile.displayNameLabel')}
          value={displayName}
          onChangeText={(value) => setValue('displayName', value, { shouldValidate: true })}
          placeholder={t('onboarding.profile.displayNamePlaceholder')}
        />

        {caloriesTrackingEnabled ? (
          <>
            <Txt variant="body" weight="700" style={styles.sectionLabel}>
              {t('onboarding.profile.bodyActivity')}
            </Txt>

            <TextField
              label={t('onboarding.profile.birthDateLabel')}
              value={birthDate}
              onChangeText={(text) =>
                setValue('birthDate', formatDateInput(text, dateInputOrder), {
                  shouldValidate: true,
                })
              }
              placeholder={t('onboarding.profile.birthDatePlaceholder')}
              inputMode="numeric"
              keyboardType="number-pad"
              maxLength={10}
              error={errors.birthDate ? t('onboarding.profile.errors.birthDate') : undefined}
            />

            <View style={styles.inputRow}>
              <View style={styles.flex}>
                <TextField
                  label={t('onboarding.profile.heightLabel')}
                  value={heightCm}
                  onChangeText={(value) => setValue('heightCm', value, { shouldValidate: true })}
                  placeholder={t('onboarding.profile.heightPlaceholder')}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  error={errors.heightCm ? t('onboarding.profile.errors.height') : undefined}
                />
              </View>
              <View style={styles.flex}>
                <TextField
                  label={t('onboarding.profile.weightLabel')}
                  value={weightKg}
                  onChangeText={(value) => setValue('weightKg', value, { shouldValidate: true })}
                  placeholder={t('onboarding.profile.weightPlaceholder')}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  error={errors.weightKg ? t('onboarding.profile.errors.weight') : undefined}
                />
              </View>
            </View>

            <Txt variant="body" weight="600" style={styles.sectionLabel}>
              {t('onboarding.profile.calculationBasis')}
            </Txt>
            <View
              style={styles.sexRow}
              accessibilityRole="radiogroup"
              accessibilityLabel={t('onboarding.profile.sexGroup')}>
              {SEX_OPTIONS.map((opt) => {
                const selected = sex === opt.value;
                return (
                  <Press
                    key={opt.value}
                    onPress={() => setValue('sex', selected ? undefined : opt.value)}
                    accessibilityRole="radio"
                    accessibilityLabel={t(opt.labelKey)}
                    accessibilityState={{ selected }}
                    haptic="selection"
                    containerStyle={styles.flex}
                    selected={selected}
                    style={styles.sexButton}>
                    <Txt variant="body" tone="primary" weight="600">
                      {t(opt.labelKey)}
                    </Txt>
                  </Press>
                );
              })}
            </View>

            <Txt variant="body" weight="600" style={styles.sectionLabel}>
              {t('onboarding.profile.weightGoal')}
            </Txt>
            <View
              style={styles.choiceList}
              accessibilityRole="radiogroup"
              accessibilityLabel={t('onboarding.profile.weightGoal')}>
              {GOAL_OPTIONS.map((opt) => {
                const selected = weightGoal === opt.value;
                return (
                  <Press
                    key={opt.value}
                    onPress={() => setValue('weightGoal', selected ? undefined : opt.value)}
                    accessibilityRole="radio"
                    accessibilityLabel={t(opt.labelKey)}
                    accessibilityState={{ selected }}
                    haptic="selection"
                    selected={selected}
                    style={styles.choice}>
                    <Txt variant="body" tone="primary" weight="500">
                      {t(opt.labelKey)}
                    </Txt>
                  </Press>
                );
              })}
            </View>

            <Txt variant="body" weight="600" style={styles.sectionLabel}>
              {t('onboarding.profile.activityLevel')}
            </Txt>
            <View
              style={styles.choiceList}
              accessibilityRole="radiogroup"
              accessibilityLabel={t('onboarding.profile.activityLevel')}>
              {ACTIVITY_OPTIONS.map((opt) => {
                const selected = activityLevel === opt.value;
                return (
                  <Press
                    key={opt.value}
                    onPress={() => setValue('activityLevel', selected ? undefined : opt.value)}
                    accessibilityRole="radio"
                    accessibilityLabel={t(opt.labelKey)}
                    accessibilityState={{ selected }}
                    haptic="selection"
                    selected={selected}
                    style={styles.choice}>
                    <Txt variant="body" tone="primary" weight="500">
                      {t(opt.labelKey)}
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
          <Button
            title={t('onboarding.profile.next')}
            onPress={() => void handleSubmit(submit)()}
          />
        </View>
        <View style={styles.flex}>
          <Button title={t('onboarding.profile.skip')} variant="secondary" onPress={onSkip} />
        </View>
      </View>
    </View>
  );
}
