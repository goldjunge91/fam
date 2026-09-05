import { router } from 'expo-router';
import { View } from 'react-native';
import { Button } from '@/components/ui/buttons';
import { Txt } from '@/constants/ui';
import { useHouseholds } from '@/features/household/api';
import { useOnboarding } from '../onboarding-store';

export function CompleteStepForm() {
  const { state, completeOnboarding, isLoading, error } = useOnboarding();
  const { data: households } = useHouseholds();

  const handleFinish = async () => {
    // Nur nach erfolgreichem Abschluss zum Dashboard navigieren.
    const erfolgreich = await completeOnboarding();
    if (!erfolgreich) return;

    router.replace('/');
  };

  const householdName =
    households?.[0]?.name ||
    (state.household.choice === 'create'
      ? state.household.name || 'deinen neuen Haushalt'
      : state.household.choice === 'join'
        ? 'deinen Haushalt'
        : 'deinen persönlichen Bereich');

  return (
    <View className="complete-container">
      <View className="complete-icon-circle">
        <Txt variant="display" center>
          🎉
        </Txt>
      </View>

      <Txt variant="title" weight="700" center>
        Alles bereit!
      </Txt>
      <Txt variant="body" tone="secondary" center className="px-two">
        {`Dein Profil ist eingerichtet und du bist startklar für ${householdName}.`}
      </Txt>

      {error ? (
        <Txt variant="label" tone="danger" center>
          {error}
        </Txt>
      ) : null}

      <View className="complete-button-container">
        <Button
          label={isLoading ? 'Speichern...' : 'Zum Dashboard'}
          onPress={handleFinish}
          loading={isLoading}
        />
      </View>
    </View>
  );
}
