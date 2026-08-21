import { useQueryClient } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { BackButton } from '@/components/ui/buttons';
import { ProgressBar } from '@/components/ui/progress-bar';
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
  const { state, setStep, nextStep, prevStep } = useOnboarding();
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
    <Screen
      title={currentStep === 1 ? 'Willkommen' : `Schritt ${currentStep} von ${TOTAL_STEPS}`}
      // Schritt 4 (Haushalt) bringt seine eigene ScrollView im
      // KeyboardAvoidingView mit — nur so kann er beim Tippen zuverlässig
      // zum fokussierten Feld hochscrollen (siehe household-step.tsx).
      scroll={currentStep !== 4}>
      {/* Onboarding-Navigationsleiste (Zurück-Button, Fortschrittsbalken, Abmelden-Notausstieg) */}
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
      {currentStep === 1 && <WelcomeCarousel onStart={() => setStep(2)} />}
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
  return (
    <OnboardingProvider>
      <OnboardingContent />
    </OnboardingProvider>
  );
}
