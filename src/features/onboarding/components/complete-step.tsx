import { Button, Column, Host, Spacer, Text } from '@expo/ui';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useOnboarding } from '../context/onboarding-context';

export function CompleteStepForm() {
  const theme = useTheme();
  const { state, completeOnboarding, isLoading, error } = useOnboarding();

  const handleFinish = async () => {
    await completeOnboarding();
    router.replace('/');
  };

  const householdName =
    state.household.choice === 'create'
      ? state.household.name || 'deinen neuen Haushalt'
      : state.household.choice === 'join'
        ? 'deinen Haushalt'
        : 'deinen persönlichen Bereich';

  return (
    <Host matchContents>
      <Column style={styles.container}>
        <Text style={[styles.icon, { fontSize: 64 }]}>🎉</Text>
        <Spacer height={Spacing.two} />
        <Text style={[styles.heading, { color: theme.text }]}>Alles bereit!</Text>
        <Spacer height={Spacing.one} />
        <Text style={[styles.subheading, { color: theme.textSecondary }]}>
          Dein Profil ist eingerichtet und du bist startklar für {householdName}.
        </Text>

        {error && (
          <>
            <Spacer height={Spacing.two} />
            <Text style={{ color: theme.danger }}>{error}</Text>
          </>
        )}

        <Spacer height={Spacing.four} />

        <Button onPress={handleFinish}>{isLoading ? 'Speichern...' : 'Zum Dashboard'}</Button>
      </Column>
    </Host>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    textAlign: 'center',
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subheading: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
