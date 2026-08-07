import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/button';
import { Spacing } from '@/constants/theme';
import { useHouseholds } from '@/features/household/api';
import { useTheme } from '@/hooks/use-theme';
import { useOnboarding } from '../context/onboarding-context';

export function CompleteStepForm() {
  const theme = useTheme();
  const { state, completeOnboarding, isLoading, error } = useOnboarding();
  const { data: households } = useHouseholds();

  const handleFinish = async () => {
    await completeOnboarding();
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
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: theme.backgroundElement }]}>
        <Text style={styles.icon}>🎉</Text>
      </View>

      <Text style={[styles.heading, { color: theme.text }]}>Alles bereit!</Text>
      <Text style={[styles.subheading, { color: theme.textSecondary }]}>
        {`Dein Profil ist eingerichtet und du bist startklar für ${householdName}.`}
      </Text>

      {error ? <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text> : null}

      <View style={styles.buttonContainer}>
        <Button
          label={isLoading ? 'Speichern...' : 'Zum Dashboard'}
          onPress={handleFinish}
          loading={isLoading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.two,
  },
  icon: {
    fontSize: 52,
    textAlign: 'center',
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  subheading: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.two,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    marginTop: Spacing.two,
  },
});
