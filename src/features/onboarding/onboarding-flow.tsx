import { useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/screen';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { signOutAndClearLocalData } from '@/features/auth/sign-out';
import { useTheme } from '@/hooks/use-theme';
import { AccountStepForm } from './components/account-step';
import { CompleteStepForm } from './components/complete-step';
import { HouseholdStepForm } from './components/household-step';
import { ModuleSelectorForm } from './components/module-selector';
import { PermissionsStepForm } from './components/permissions-step';
import { ProfileStepForm } from './components/profile-step-form';
import { WelcomeCarousel } from './components/welcome-carousel';
import { OnboardingProvider, useOnboarding } from './context/onboarding-context';

const TOTAL_STEPS = 7;

function OnboardingContent() {
  const theme = useTheme();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { state, setStep, nextStep } = useOnboarding();
  const currentStep = state.currentStep;

  // Notausstieg (#128): Ein Nutzer, dessen Account in einem kaputten Zustand
  // steckt (z. B. E-Mail nie bestaetigt, fehlendes Profil), kam bisher ab
  // Schritt 2 nirgends mehr raus — es gibt weder einen Zurueck-Button noch
  // eine andere Stelle im Onboarding, die abmeldet. Sichtbar ab Schritt 2,
  // weil "Dein Account" (Schritt 2) selbst schon den angemeldeten Zustand
  // zeigt.
  async function handleEmergencySignOut() {
    await signOutAndClearLocalData(queryClient);
    setStep(1);
  }

  return (
    <Screen title={currentStep === 1 ? 'Willkommen' : `Schritt ${currentStep} von ${TOTAL_STEPS}`}>
      {currentStep > 1 && currentStep < TOTAL_STEPS && (
        <View style={styles.progressContainer}>
          <View style={styles.progressRow}>
            {Array.from({ length: TOTAL_STEPS }).map((_, idx) => {
              const stepNum = idx + 1;
              const active = stepNum <= currentStep;
              return (
                <View
                  key={stepNum}
                  style={[
                    styles.progressBar,
                    {
                      backgroundColor: active ? theme.accent : theme.border,
                    },
                  ]}
                />
              );
            })}
          </View>
          {session && (
            <Pressable onPress={handleEmergencySignOut} style={styles.signOutLink}>
              <Text style={[styles.signOutText, { color: theme.textSecondary }]}>
                Nicht du? Abmelden und neu starten
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {currentStep === 1 && <WelcomeCarousel onStart={() => setStep(2)} />}
      {currentStep === 2 && <AccountStepForm onNext={() => setStep(3)} />}
      {currentStep === 3 && <ProfileStepForm onNext={nextStep} onSkip={nextStep} />}
      {currentStep === 4 && <HouseholdStepForm onNext={nextStep} onSkip={nextStep} />}
      {currentStep === 5 && <ModuleSelectorForm onNext={nextStep} onSkip={nextStep} />}
      {currentStep === 6 && <PermissionsStepForm onNext={nextStep} onSkip={nextStep} />}
      {currentStep === 7 && <CompleteStepForm />}
    </Screen>
  );
}

export function OnboardingFlow() {
  return (
    <OnboardingProvider>
      <OnboardingContent />
    </OnboardingProvider>
  );
}

const styles = StyleSheet.create({
  progressContainer: {
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
  progressRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  signOutLink: {
    alignSelf: 'center',
    marginTop: Spacing.two,
    padding: Spacing.one,
  },
  signOutText: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
});
