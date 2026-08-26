import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/buttons';
import { useHouseholds } from '@/features/household/api';
import { useOnboarding } from '../context/onboarding-context';

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
        <Text className="complete-icon">🎉</Text>
      </View>

      <Text className="complete-heading">Alles bereit!</Text>
      <Text className="complete-subheading">
        {`Dein Profil ist eingerichtet und du bist startklar für ${householdName}.`}
      </Text>

      {error ? <Text className="complete-error">{error}</Text> : null}

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
