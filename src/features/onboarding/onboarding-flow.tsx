import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { View } from 'react-native';
import { KeyboardToolbar } from 'react-native-keyboard-controller';
import { StyleSheet } from 'react-native-unistyles';
import { BackButton } from '@/components/layout/back-button';
import { Screen } from '@/components/layout/screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Press, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { signOutAndClearLocalData } from '@/features/auth/sign-out';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { debugLogEvent } from '@/lib/observability/debug-log';
import { AccountStepForm } from './components/account-step';
import { CompleteStepForm } from './components/complete-step';
import { HouseholdStepForm } from './components/household-step';
import { ModuleSelectorForm } from './components/module-selector';
import { PermissionsStepForm } from './components/permissions-step';
import { ProfileStepForm } from './components/profile-step-form';
import { WelcomeCarousel } from './components/welcome-carousel';
import { useOnboarding } from './onboarding-store';

const TOTAL_STEPS = 7;

const STEP_NAMES: Record<number, string> = {
  1: 'welcome',
  2: 'account',
  3: 'profile',
  4: 'household',
  5: 'modules',
  6: 'permissions',
  7: 'complete',
};

const styles = StyleSheet.create((theme, rt) => ({
  progressContainer: {
    paddingHorizontal: theme.space.xxl,
    marginBottom: theme.space.sm,
  },
  signoutLink: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: theme.space.sm,
    paddingHorizontal: theme.space.sm,
  },
  signoutText: {
    textDecorationLine: 'underline',
  },
  keyboardContent: {
    paddingBottom: rt.insets.ime,
  },
}));

function OnboardingContent() {
  const { colors } = useTheme();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { state, setStep, nextStep, prevStep } = useOnboarding();
  const currentStep = state.currentStep;

  useEffect(() => {
    const stepName = STEP_NAMES[currentStep] ?? `step_${currentStep}`;
    trackAnalyticsEvent('onboarding.step.viewed', { step: stepName });
  }, [currentStep]);

  // Ab Schritt 2 ermöglicht der Notausstieg einen Neustart des Flows.
  async function handleEmergencySignOut() {
    debugLogEvent('auth.sign-out.button-clicked', { source: 'onboarding-emergency' });
    await signOutAndClearLocalData(queryClient);
    setStep(1);
  }

  return (
    <>
      <Screen
        title={currentStep === 1 ? 'Willkommen' : `Schritt ${currentStep} von ${TOTAL_STEPS}`}
        // Schritte 2 und 4 verwalten ihren KeyboardAwareScrollView und den
        // unteren Inhaltsabstand selbst.
        scroll={currentStep !== 2 && currentStep !== 4}
        applyBottomPadding={currentStep !== 2 && currentStep !== 4}
        contentStyle={currentStep === 3 ? styles.keyboardContent : undefined}>
        {currentStep > 1 && currentStep < TOTAL_STEPS && (
          <View style={styles.progressContainer}>
            {/* Nutzt bewusst `prevStep` aus dem Context statt Routing — die
                Schritte sind kein eigener Screen, sondern nur `currentStep`
                im Onboarding-State. */}
            <BackButton label="Zurück" onPress={prevStep} />
            {/* ProgressBar erwartet einen echten Farbwert aus dem aktiven Theme. */}
            <ProgressBar value={currentStep / TOTAL_STEPS} color={colors.accent} />
            {session && (
              <Press
                onPress={() => void handleEmergencySignOut()}
                accessibilityRole="button"
                accessibilityLabel="Abmelden und Onboarding neu starten"
                style={styles.signoutLink}>
                <Txt variant="caption" tone="secondary" style={styles.signoutText}>
                  Nicht du? Abmelden und neu starten
                </Txt>
              </Press>
            )}
          </View>
        )}

        {/* Schritt 1: Willkommens-Karussell / Feature-Überblick */}
        {currentStep === 1 && (
          <WelcomeCarousel
            onStart={() => {
              trackAnalyticsEvent('onboarding.flow.started');
              setStep(2);
            }}
          />
        )}

        {/* Schritt 2: Account anlegen / Anmelden */}
        {currentStep === 2 && <AccountStepForm onNext={() => setStep(3)} />}
        {/* Schritt 3: Persönliches Profil (Körperdaten, Aktivitätslevel, Ziele) */}
        {currentStep === 3 && <ProfileStepForm onNext={nextStep} onSkip={nextStep} />}
        {/* Schritt 4: Haushalt erstellen oder beitreten */}
        {currentStep === 4 && <HouseholdStepForm onNext={nextStep} onSkip={nextStep} />}
        {/* Schritt 5: Modulauswahl (Vorrat, Kalorien, Einkaufsliste, Essensplaner) */}
        {currentStep === 5 && <ModuleSelectorForm onNext={nextStep} onSkip={nextStep} />}
        {/* Schritt 6: System-Berechtigungen (Benachrichtigungen, Kamera) */}
        {currentStep === 6 && <PermissionsStepForm onNext={nextStep} onSkip={nextStep} />}
        {/* Schritt 7: Abschluss & Starten der App */}
        {currentStep === 7 && <CompleteStepForm />}
      </Screen>
      {currentStep >= 2 && currentStep <= 4 ? <KeyboardToolbar /> : null}
    </>
  );
}

export function OnboardingFlow() {
  return <OnboardingContent />;
}
