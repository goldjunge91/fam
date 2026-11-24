import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { StyleSheet } from 'react-native-unistyles';
import { Button, onboardingStyles, Press, Surface, TextField, Txt } from '@/constants/ui';
import {
  useCreateHouseholdMutation,
  useHouseholds,
  useRedeemInviteMutation,
} from '@/features/household/api';
import { getOnboardingErrorMessage } from '../onboarding-errors';
import { validateHouseholdOnboarding } from '../onboarding-helpers';
import { useOnboarding } from '../onboarding-store';
import { DEFAULT_HOUSEHOLD_NAME, type HouseholdChoice } from '../types';

interface HouseholdStepFormProps {
  onNext: () => void;
  onSkip: () => void;
}

const styles = StyleSheet.create((theme, rt) => ({
  scroll: {
    flex: 1,
  },
  content: {
    gap: theme.space.lg,
    // Preserve the scroll tail from the onboarding layout below the actions.
    paddingBottom: theme.space.xxxl + rt.insets.ime,
  },
  activeCard: {
    gap: theme.space.xs,
    padding: theme.space.lg,
    marginVertical: theme.space.xs,
  },
  choices: {
    gap: theme.space.sm,
    marginTop: theme.space.xs,
  },
  choice: {
    gap: theme.space.xs,
    padding: theme.space.lg,
  },
  error: {
    marginTop: theme.space.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
    marginTop: theme.space.lg,
  },
  flex: {
    flex: 1,
  },
}));

export function HouseholdStepForm({ onNext, onSkip }: HouseholdStepFormProps) {
  const { t } = useTranslation();
  const { state, updateHouseholdData } = useOnboarding();
  const { data: households } = useHouseholds();
  const activeHousehold = households?.[0];

  const createHouseholdMutation = useCreateHouseholdMutation();
  const redeemInviteMutation = useRedeemInviteMutation();

  const [choice, setChoice] = useState<HouseholdChoice>(
    state.household.choice ?? (activeHousehold ? 'solo' : 'solo'),
  );
  const [householdName, setHouseholdName] = useState(state.household.name ?? '');
  const [inviteCode, setInviteCode] = useState(state.household.inviteCode ?? '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isPending = createHouseholdMutation.isPending || redeemInviteMutation.isPending;

  const handleNext = async () => {
    setErrorMsg(null);

    // Bei "create" liefert die UI absichtlich einen Fallback-Namen, bevor
    // validiert wird - ein leerer Name soll die Erstellung nicht blockieren.
    const name = choice === 'create' ? householdName.trim() || DEFAULT_HOUSEHOLD_NAME : undefined;
    const code = choice === 'join' ? inviteCode.trim() : undefined;

    updateHouseholdData({ choice, name, inviteCode: code });

    if (activeHousehold) {
      onNext();
      return;
    }

    if (!validateHouseholdOnboarding({ choice, name, inviteCode: code })) {
      setErrorMsg(t('onboarding.household.missingInviteCode'));
      return;
    }

    try {
      if (choice === 'create') {
        await createHouseholdMutation.mutateAsync(name ?? DEFAULT_HOUSEHOLD_NAME);
      } else if (choice === 'join') {
        await redeemInviteMutation.mutateAsync(code ?? '');
      } else if (choice === 'solo') {
        await createHouseholdMutation.mutateAsync(DEFAULT_HOUSEHOLD_NAME);
      }
      onNext();
    } catch (err) {
      if (err instanceof Error) {
        setErrorMsg(getOnboardingErrorMessage(err, t));
      } else {
        setErrorMsg(t('onboarding.household.mutationError'));
      }
    }
  };

  return (
    // Eigene KeyboardAwareScrollView für den Haushalts-Schritt.
    <KeyboardAwareScrollView
      style={styles.scroll}
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}>
      <Txt variant="subheading" weight="700">
        {t('onboarding.household.heading')}
      </Txt>
      <Txt variant="body" tone="secondary">
        {t('onboarding.household.description')}
      </Txt>

      {/* Aktiver Haushalt Banner */}
      {activeHousehold ? (
        <Surface tone="surface" style={[styles.activeCard, onboardingStyles.activeHousehold]}>
          <Txt variant="eyebrow" tone="success" weight="700">
            {t('onboarding.household.activeDetected')}
          </Txt>
          <Txt variant="body" weight="700">
            {activeHousehold.name}
          </Txt>
        </Surface>
      ) : null}

      <View
        style={styles.choices}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('onboarding.household.groupLabel')}>
        <Press
          onPress={() => setChoice('create')}
          accessibilityRole="radio"
          accessibilityLabel={t('onboarding.household.create.accessibility')}
          accessibilityState={{ selected: choice === 'create' }}
          haptic="selection"
          selected={choice === 'create'}
          style={styles.choice}>
          <Txt variant="body" tone="primary" weight="700">
            {t('onboarding.household.create.title')}
          </Txt>
          <Txt variant="label" tone="primary">
            {t('onboarding.household.create.description')}
          </Txt>
        </Press>

        <Press
          onPress={() => setChoice('join')}
          accessibilityRole="radio"
          accessibilityLabel={t('onboarding.household.join.accessibility')}
          accessibilityState={{ selected: choice === 'join' }}
          haptic="selection"
          selected={choice === 'join'}
          style={styles.choice}>
          <Txt variant="body" tone="primary" weight="700">
            {t('onboarding.household.join.title')}
          </Txt>
          <Txt variant="label" tone="primary">
            {t('onboarding.household.join.description')}
          </Txt>
        </Press>

        <Press
          onPress={() => setChoice('solo')}
          accessibilityRole="radio"
          accessibilityLabel={
            activeHousehold
              ? t('onboarding.household.solo.accessibilityWithHousehold', {
                  name: activeHousehold.name,
                })
              : t('onboarding.household.solo.accessibility')
          }
          accessibilityState={{ selected: choice === 'solo' }}
          haptic="selection"
          selected={choice === 'solo'}
          style={styles.choice}>
          <Txt variant="body" tone="primary" weight="700">
            👤{' '}
            {activeHousehold
              ? t('onboarding.household.solo.titleWithHousehold', { name: activeHousehold.name })
              : t('onboarding.household.solo.title')}
          </Txt>
          <Txt variant="label" tone="primary">
            {activeHousehold
              ? t('onboarding.household.solo.descriptionWithHousehold')
              : t('onboarding.household.solo.description')}
          </Txt>
        </Press>
      </View>

      {choice === 'create' && (
        <TextField
          testID="onboarding-household-name"
          label={t('onboarding.household.nameLabel')}
          value={householdName}
          onChangeText={setHouseholdName}
          placeholder={t('onboarding.household.namePlaceholder')}
        />
      )}

      {choice === 'join' && (
        <TextField
          testID="onboarding-household-invite-code"
          label={t('onboarding.household.inviteCodeLabel')}
          value={inviteCode}
          onChangeText={setInviteCode}
          placeholder={t('onboarding.household.inviteCodePlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}

      {errorMsg ? (
        <Txt variant="label" tone="danger" style={styles.error}>
          {errorMsg}
        </Txt>
      ) : null}

      <View style={styles.buttonRow}>
        <View style={styles.flex}>
          <Button title={t('onboarding.household.next')} onPress={handleNext} loading={isPending} />
        </View>
        <View style={styles.flex}>
          <Button
            title={t('onboarding.household.skip')}
            variant="secondary"
            onPress={onSkip}
            disabled={isPending}
          />
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
