import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button, Surface, Txt } from '@/constants/ui';
import { useHouseholds } from '@/features/household/api';
import { useOnboarding } from '../onboarding-store';

// Die 96px-Erfolgskugel bleibt als lokale Illustration-Geometrie erhalten;
// Fläche und Typografie kommen aus den zentralen UI-/Theme-Verantwortlichen.
const styles = StyleSheet.create((theme) => ({
  root: {
    alignItems: 'center',
    gap: theme.space.lg,
    paddingVertical: theme.space.sm,
  },
  iconCircle: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.space.sm,
    borderRadius: theme.radius.pill,
  },
  subtitle: {
    paddingHorizontal: theme.space.sm,
  },
  buttonContainer: {
    width: '100%',
    marginTop: theme.space.sm,
  },
}));

export function CompleteStepForm() {
  const { t } = useTranslation();
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
      ? state.household.name || t('onboarding.complete.newHousehold')
      : state.household.choice === 'join'
        ? t('onboarding.complete.household')
        : t('onboarding.complete.personal'));

  return (
    <View style={styles.root}>
      <Surface tone="surface" style={styles.iconCircle}>
        <Txt variant="display" center>
          🎉
        </Txt>
      </Surface>

      <Txt variant="title" weight="700" center>
        {t('onboarding.complete.title')}
      </Txt>
      <Txt variant="body" tone="secondary" center style={styles.subtitle}>
        {t('onboarding.complete.description', { household: householdName })}
      </Txt>

      {error ? (
        <Txt variant="label" tone="danger" center>
          {error}
        </Txt>
      ) : null}

      <View style={styles.buttonContainer}>
        <Button
          title={isLoading ? t('onboarding.complete.save') : t('onboarding.complete.dashboard')}
          onPress={handleFinish}
          loading={isLoading}
        />
      </View>
    </View>
  );
}
