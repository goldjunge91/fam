import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { BackButton } from '@/components/ui/buttons';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useSession } from '@/features/auth/session-provider';
import { signOutAndClearLocalData } from '@/features/auth/sign-out';
import { useTheme } from '@/hooks/use-theme';
import { trackAnalyticsEvent } from '@/lib/analytics';
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

function OnboardingContent() {
  const theme = useTheme();
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
    await signOutAndClearLocalData(queryClient);
    setStep(1);
  }

  return (
    <Screen
      title={currentStep === 1 ? 'Willkommen' : `Schritt ${currentStep} von ${TOTAL_STEPS}`}
      // Schritt 4 verwaltet seine ScrollView selbst.
      scroll={currentStep !== 4}>
      {currentStep > 1 && currentStep < TOTAL_STEPS && (
        <View className="progress-container">
          {/* Nutzt bewusst `prevStep` aus dem Context statt Routing — die
              Schritte sind kein eigener Screen, sondern nur `currentStep`
              im Onboarding-State. */}
          <BackButton label="Zurück" onPress={prevStep} />
          {/* ProgressBar erwartet einen echten Farbwert (kein className-Prop). */}
          <ProgressBar value={currentStep / TOTAL_STEPS} color={theme.accent} />
          {session && (
            <Pressable onPress={handleEmergencySignOut} className="signout-link">
              <Text className="signout-text">Nicht du? Abmelden und neu starten</Text>
            </Pressable>
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
  );
}

export function OnboardingFlow() {
  return <OnboardingContent />;
}
