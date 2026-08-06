import { StyleSheet, View } from 'react-native';
import { Screen } from '@/components/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CompleteStepForm } from './components/complete-step';
import { HouseholdStepForm } from './components/household-step';
import { ModuleSelectorForm } from './components/module-selector';
import { PermissionsStepForm } from './components/permissions-step';
import { ProfileStepForm } from './components/profile-step-form';
import { WelcomeCarousel } from './components/welcome-carousel';
import { OnboardingProvider, useOnboarding } from './context/onboarding-context';

const TOTAL_STEPS = 6;

function OnboardingContent() {
  const theme = useTheme();
  const { state, setStep, nextStep } = useOnboarding();
  const currentStep = state.currentStep;

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
        </View>
      )}

      {currentStep === 1 && <WelcomeCarousel onStart={() => setStep(2)} />}
      {currentStep === 2 && <ProfileStepForm onNext={nextStep} onSkip={nextStep} />}
      {currentStep === 3 && <HouseholdStepForm onNext={nextStep} onSkip={nextStep} />}
      {currentStep === 4 && <ModuleSelectorForm onNext={nextStep} onSkip={nextStep} />}
      {currentStep === 5 && <PermissionsStepForm onNext={nextStep} onSkip={nextStep} />}
      {currentStep === 6 && <CompleteStepForm />}
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
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
});
