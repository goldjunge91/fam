import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { markOnboardingCompleted, updateProfile, useProfile } from '@/features/auth/api';
import { fieldErrors, profileSchema } from '@/features/auth/auth-schemas';
import { StepAccount } from '@/features/auth/onboarding/step-account';
import { StepCreateHousehold } from '@/features/auth/onboarding/step-create-household';
import { StepHouseholdInfo } from '@/features/auth/onboarding/step-household-info';
import { StepIndicator } from '@/features/auth/onboarding/step-indicator';
import { StepInventory } from '@/features/auth/onboarding/step-inventory';
import { StepProfile } from '@/features/auth/onboarding/step-profile';
import { StepWelcome } from '@/features/auth/onboarding/step-welcome';
import { markOnboardingSessionCompleted } from '@/features/auth/onboarding-session';
import { useSession } from '@/features/auth/session-provider';
import { useTheme } from '@/hooks/use-theme';

/**
 * 6-Schritte Onboarding Workflow (#104):
 * Jedem Schritt entspricht eine eigene Datei unter src/features/auth/onboarding/
 */
export function OnboardingScreen() {
  const { session } = useSession();
  const { data: profile } = useProfile(session?.user.id);
  const queryClient = useQueryClient();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // Profil Formular (Schritt 6)
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | undefined>();
  const [activityLevel, setActivityLevel] = useState<
    'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | undefined
  >();
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [profileFormError, setProfileFormError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Bestehende Profil-Daten aus der Datenbank vorausfüllen
  useEffect(() => {
    if (profile) {
      if (profile.display_name && !displayName) {
        setDisplayName(profile.display_name);
      }
      if (profile.birth_date && !birthDate) {
        const parts = profile.birth_date.split('-');
        if (parts.length === 3) {
          setBirthDate(`${parts[2]}.${parts[1]}.${parts[0]}`);
        } else {
          setBirthDate(profile.birth_date);
        }
      }
      if (profile.height_cm && !heightCm) {
        setHeightCm(String(profile.height_cm));
      }
      if (profile.sex && !sex) {
        setSex(profile.sex as 'male' | 'female');
      }
      if (profile.activity_level && !activityLevel) {
        setActivityLevel(profile.activity_level);
      }
    }
  }, [profile]);

  async function markCompletedInCacheAndFinish() {
    markOnboardingSessionCompleted();
    if (session?.user.id) {
      const nowIso = new Date().toISOString();
      queryClient.setQueryData(
        ['profile', session.user.id],
        (old: Record<string, unknown> | null) => ({
          ...(old ?? {}),
          onboarding_completed_at: nowIso,
        }),
      );
      await queryClient.invalidateQueries({ queryKey: ['profile', session.user.id] });
    }
    router.replace('/');
  }

  async function handleSubmitProfile() {
    if (profileLoading || !session) return;

    setProfileFormError(null);
    const parsed = profileSchema.safeParse({
      displayName: displayName.trim() || undefined,
      birthDate: birthDate.trim() || undefined,
      heightCm: heightCm.trim() ? Number(heightCm.replace(',', '.')) : undefined,
      sex,
      activityLevel,
    });

    if (!parsed.success) {
      setProfileErrors(fieldErrors(parsed.error));
      return;
    }

    setProfileErrors({});
    setProfileLoading(true);
    const { error } = await updateProfile(session.user.id, parsed.data);
    setProfileLoading(false);

    if (error) {
      setProfileFormError(error.message);
      return;
    }

    await markCompletedInCacheAndFinish();
  }

  return (
    <Screen title={`Onboarding (${step}/6)`} scroll={false}>
      <View style={styles.container}>
        {/* Scrollbarer Inhalt in der Mitte */}
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}>
          <StepIndicator currentStep={step} totalSteps={6} />

          {step === 1 && <StepWelcome />}
          {step === 2 && <StepInventory />}
          {step === 3 && <StepHouseholdInfo />}
          {step === 4 && <StepAccount onNext={() => setStep(5)} />}
          {step === 5 && <StepCreateHousehold onNext={() => setStep(6)} />}
          {step === 6 && (
            <StepProfile
              displayName={displayName}
              setDisplayName={setDisplayName}
              birthDate={birthDate}
              setBirthDate={setBirthDate}
              heightCm={heightCm}
              setHeightCm={setHeightCm}
              sex={sex}
              setSex={setSex}
              activityLevel={activityLevel}
              setActivityLevel={setActivityLevel}
              profileErrors={profileErrors}
            />
          )}

          {profileFormError ? (
            <ThemedText type="small" themeColor="danger">
              {profileFormError}
            </ThemedText>
          ) : null}
        </ScrollView>

        {/* Fester Footer unten fixiert */}
        <View
          style={[
            styles.fixedFooter,
            {
              borderTopColor: theme.border,
              backgroundColor: theme.background,
              paddingBottom: Math.max(insets.bottom, Spacing.two),
            },
          ]}>
          <View style={styles.buttonRow}>
            {step > 1 && (
              <View style={styles.buttonCol}>
                <Button
                  label="Zurück"
                  variant="secondary"
                  onPress={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4 | 5 | 6)}
                />
              </View>
            )}

            <View style={styles.buttonCol}>
              {step < 6 ? (
                <Button
                  label="Weiter"
                  onPress={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4 | 5 | 6)}
                />
              ) : (
                <Button label="Loslegen!" onPress={handleSubmitProfile} loading={profileLoading} />
              )}
            </View>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  fixedFooter: {
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  buttonCol: {
    flex: 1,
  },
});
