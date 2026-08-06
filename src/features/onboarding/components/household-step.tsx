import { Button, Column, Host, Spacer, Text } from '@expo/ui';
import { useState } from 'react';
import { Pressable, Text as RNText, StyleSheet, View } from 'react-native';
import { TextField } from '@/components/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useOnboarding } from '../context/onboarding-context';
import type { HouseholdChoice } from '../types';

interface HouseholdStepFormProps {
  onNext: () => void;
  onSkip: () => void;
}

export function HouseholdStepForm({ onNext, onSkip }: HouseholdStepFormProps) {
  const theme = useTheme();
  const { state, updateHouseholdData } = useOnboarding();

  const [choice, setChoice] = useState<HouseholdChoice>(state.household.choice ?? 'solo');
  const [householdName, setHouseholdName] = useState(state.household.name ?? '');
  const [inviteCode, setInviteCode] = useState(state.household.inviteCode ?? '');

  const handleNext = () => {
    updateHouseholdData({
      choice,
      name: choice === 'create' ? householdName.trim() || 'Mein Haushalt' : undefined,
      inviteCode: choice === 'join' ? inviteCode.trim() : undefined,
    });
    onNext();
  };

  return (
    <Host matchContents>
      <Column style={styles.container}>
        <Text textStyle={{ ...styles.heading, color: theme.text }}>Dein Haushalt</Text>
        <Text textStyle={{ ...styles.subheading, color: theme.textSecondary }}>
          Entscheide, wie du die App für Vorrat & Einkäufe nutzen möchtest.
        </Text>

        <Spacer size={Spacing.three} />

        <View style={styles.choiceList}>
          <Pressable
            onPress={() => setChoice('create')}
            style={[
              styles.card,
              {
                backgroundColor: choice === 'create' ? theme.accent : theme.backgroundElement,
                borderColor: choice === 'create' ? theme.accent : theme.border,
              },
            ]}>
            <RNText
              style={[styles.cardTitle, { color: choice === 'create' ? '#ffffff' : theme.text }]}>
              🏠 Neuen Haushalt erstellen
            </RNText>
            <RNText
              style={[
                styles.cardDesc,
                { color: choice === 'create' ? '#f0f0f0' : theme.textSecondary },
              ]}>
              Erstelle eine eigene Gruppe für deine Familie oder WG und lade Mitglieder ein.
            </RNText>
          </Pressable>

          <Pressable
            onPress={() => setChoice('join')}
            style={[
              styles.card,
              {
                backgroundColor: choice === 'join' ? theme.accent : theme.backgroundElement,
                borderColor: choice === 'join' ? theme.accent : theme.border,
              },
            ]}>
            <RNText
              style={[styles.cardTitle, { color: choice === 'join' ? '#ffffff' : theme.text }]}>
              🔗 Einem Haushalt beitreten
            </RNText>
            <RNText
              style={[
                styles.cardDesc,
                { color: choice === 'join' ? '#f0f0f0' : theme.textSecondary },
              ]}>
              Gib einen 6-stelligen Einladungscode ein oder scanne später einen QR-Code.
            </RNText>
          </Pressable>

          <Pressable
            onPress={() => setChoice('solo')}
            style={[
              styles.card,
              {
                backgroundColor: choice === 'solo' ? theme.accent : theme.backgroundElement,
                borderColor: choice === 'solo' ? theme.accent : theme.border,
              },
            ]}>
            <RNText
              style={[styles.cardTitle, { color: choice === 'solo' ? '#ffffff' : theme.text }]}>
              👤 Vorerst alleine nutzen
            </RNText>
            <RNText
              style={[
                styles.cardDesc,
                { color: choice === 'solo' ? '#f0f0f0' : theme.textSecondary },
              ]}>
              Starte mit einem privaten Bereich. Du kannst jederzeit andere zum Haushalt einladen.
            </RNText>
          </Pressable>
        </View>

        <Spacer size={Spacing.three} />

        {choice === 'create' && (
          <TextField
            label="Name deines Haushalts"
            value={householdName}
            onChangeText={setHouseholdName}
            placeholder="z.B. Familie Müller"
          />
        )}

        {choice === 'join' && (
          <TextField
            label="6-stelliger Einladungscode"
            value={inviteCode}
            onChangeText={setInviteCode}
            placeholder="z.B. AB12CD"
            autoCapitalize="characters"
          />
        )}

        <Spacer size={Spacing.four} />

        <View style={styles.buttonRow}>
          <Button onPress={handleNext}>Weiter</Button>
          <Button onPress={onSkip}>Überspringen</Button>
        </View>
      </Column>
    </Host>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  subheading: {
    fontSize: 14,
  },
  choiceList: {
    gap: Spacing.two,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
