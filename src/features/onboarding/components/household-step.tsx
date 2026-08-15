import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TextField } from '@/components/text-field';
import { FontSize } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { Spacing } from '@/constants/theme';
import {
  useCreateHouseholdMutation,
  useHouseholds,
  useRedeemInviteMutation,
} from '@/features/household/api';
import { useTheme } from '@/hooks/use-theme';
import { useOnboarding } from '../context/onboarding-context';
import { validateHouseholdOnboarding } from '../onboarding-helpers';
import type { HouseholdChoice } from '../types';

interface HouseholdStepFormProps {
  onNext: () => void;
  onSkip: () => void;
}

export function HouseholdStepForm({ onNext, onSkip }: HouseholdStepFormProps) {
  const theme = useTheme();
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
    const name = choice === 'create' ? householdName.trim() || 'Mein Haushalt' : undefined;
    const code = choice === 'join' ? inviteCode.trim() : undefined;

    updateHouseholdData({ choice, name, inviteCode: code });

    if (activeHousehold) {
      onNext();
      return;
    }

    if (!validateHouseholdOnboarding({ choice, name, inviteCode: code })) {
      setErrorMsg('Bitte gib einen Einladungscode ein.');
      return;
    }

    try {
      if (choice === 'create') {
        await createHouseholdMutation.mutateAsync(name ?? 'Mein Haushalt');
      } else if (choice === 'join') {
        await redeemInviteMutation.mutateAsync(code ?? '');
      } else if (choice === 'solo') {
        await createHouseholdMutation.mutateAsync('Mein Haushalt');
      }
      onNext();
    } catch (err) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Fehler beim Erstellen oder Beitreten des Haushalts.');
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: theme.text }]}>Dein Haushalt</Text>
      <Text style={[styles.subheading, { color: theme.textSecondary }]}>
        Entscheide, wie du die App für Vorrat & Einkäufe nutzen möchtest.
      </Text>

      {/* Aktiver Haushalt Banner */}
      {activeHousehold ? (
        <View
          style={[
            styles.activeCard,
            { backgroundColor: 'rgba(52, 199, 89, 0.1)', borderColor: '#34c759' },
          ]}>
          <Text style={styles.activeBadge}>✓ Aktiver Haushalt erkannt</Text>
          <Text style={[styles.activeTitle, { color: theme.text }]}>{activeHousehold.name}</Text>
        </View>
      ) : null}

      <View style={styles.choiceList}>
        <Pressable
          onPress={() => setChoice('create')}
          style={[
            styles.choiceCard,
            {
              backgroundColor: choice === 'create' ? theme.accent : theme.backgroundElement,
              borderColor: choice === 'create' ? theme.accent : theme.border,
            },
          ]}>
          <Text
            style={[styles.choiceTitle, { color: choice === 'create' ? '#ffffff' : theme.text }]}>
            🏠 Neuen Haushalt erstellen
          </Text>
          <Text
            style={[
              styles.choiceDesc,
              { color: choice === 'create' ? '#f0f0f0' : theme.textSecondary },
            ]}>
            Erstelle eine eigene Gruppe für deine Familie oder WG und lade Mitglieder ein.
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setChoice('join')}
          style={[
            styles.choiceCard,
            {
              backgroundColor: choice === 'join' ? theme.accent : theme.backgroundElement,
              borderColor: choice === 'join' ? theme.accent : theme.border,
            },
          ]}>
          <Text style={[styles.choiceTitle, { color: choice === 'join' ? '#ffffff' : theme.text }]}>
            🔗 Einem Haushalt beitreten
          </Text>
          <Text
            style={[
              styles.choiceDesc,
              { color: choice === 'join' ? '#f0f0f0' : theme.textSecondary },
            ]}>
            Gib einen 6-stelligen Einladungscode ein oder scanne später einen QR-Code.
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setChoice('solo')}
          style={[
            styles.choiceCard,
            {
              backgroundColor: choice === 'solo' ? theme.accent : theme.backgroundElement,
              borderColor: choice === 'solo' ? theme.accent : theme.border,
            },
          ]}>
          <Text style={[styles.choiceTitle, { color: choice === 'solo' ? '#ffffff' : theme.text }]}>
            👤{' '}
            {activeHousehold
              ? `Mit "${activeHousehold.name}" fortfahren`
              : 'Vorerst alleine nutzen'}
          </Text>
          <Text
            style={[
              styles.choiceDesc,
              { color: choice === 'solo' ? '#f0f0f0' : theme.textSecondary },
            ]}>
            {activeHousehold
              ? 'Behalte deinen bestehenden Haushalt und fahre fort.'
              : 'Starte mit einem privaten Bereich. Du kannst jederzeit andere einladen.'}
          </Text>
        </Pressable>
      </View>

      {choice === 'create' && (
        <TextField
          testID="onboarding-household-name"
          label="Name deines Haushalts"
          value={householdName}
          onChangeText={setHouseholdName}
          placeholder="z.B. Familie Müller"
        />
      )}

      {choice === 'join' && (
        <TextField
          testID="onboarding-household-invite-code"
          label="6-stelliger Einladungscode"
          value={inviteCode}
          onChangeText={setInviteCode}
          placeholder="z.B. AB12CD"
          autoCapitalize="characters"
        />
      )}

      {errorMsg ? (
        <Text style={{ color: theme.danger, ...FontSize[13], marginTop: Spacing.one }}>
          {errorMsg}
        </Text>
      ) : null}

      <View style={styles.buttonRow}>
        <View style={styles.buttonCol}>
          <Button label="Weiter" onPress={handleNext} loading={isPending} />
        </View>
        <View style={styles.buttonCol}>
          <Button label="Überspringen" variant="secondary" onPress={onSkip} disabled={isPending} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  heading: {
    ...FontSize[22],
    fontWeight: '700',
  },
  subheading: {
    ...FontSize[14],
    lineHeight: 20,
  },
  activeCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    gap: 4,
    marginVertical: Spacing.one,
  },
  activeBadge: {
    ...FontSize[12],
    fontWeight: '700',
    color: '#2e7d32',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeTitle: {
    ...FontSize[16],
    fontWeight: '700',
  },
  choiceList: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  choiceCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    gap: 4,
  },
  choiceTitle: {
    ...FontSize[15],
    fontWeight: '700',
  },
  choiceDesc: {
    ...FontSize[13],
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  buttonCol: {
    flex: 1,
  },
});
