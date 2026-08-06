import { Button, Column, Host, Spacer, Text } from '@expo/ui';
import { router } from 'expo-router';
import { Text as RNText, StyleSheet } from 'react-native';
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
        <Text textStyle={{ ...styles.icon }}>🎉</Text>
        <Spacer size={Spacing.two} />
        <Text textStyle={{ ...styles.heading, color: theme.text }}>Alles bereit!</Text>
        <Spacer size={Spacing.one} />
        <Text textStyle={{ ...styles.subheading, color: theme.textSecondary }}>
          {`Dein Profil ist eingerichtet und du bist startklar für ${householdName}.`}
        </Text>

        {error && (
          <>
            <Spacer size={Spacing.two} />
            <RNText style={{ color: theme.danger }}>{error}</RNText>
          </>
        )}

        <Spacer size={Spacing.four} />

        <Button onPress={handleFinish}>{isLoading ? 'Speichern...' : 'Zum Dashboard'}</Button>
      </Column>
    </Host>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
  },
  icon: {
    fontSize: 64,
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
