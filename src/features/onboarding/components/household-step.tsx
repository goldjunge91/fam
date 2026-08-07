import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { Spacing } from '@/constants/theme';
import { useHouseholds } from '@/features/household/api';
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
  const { data: households } = useHouseholds();
  const activeHousehold = households?.[0];

  const [choice, setChoice] = useState<HouseholdChoice>(
    state.household.choice ?? (activeHousehold ? 'solo' : 'solo'),
  );
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

      <View style={styles.buttonRow}>
        <View style={styles.buttonCol}>
          <Button label="Weiter" onPress={handleNext} />
        </View>
        <View style={styles.buttonCol}>
          <Button label="Überspringen" variant="secondary" onPress={onSkip} />
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
    fontSize: 22,
    fontWeight: '700',
  },
  subheading: {
    fontSize: 14,
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
    fontSize: 12,
    fontWeight: '700',
    color: '#2e7d32',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeTitle: {
    fontSize: 16,
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
    fontSize: 15,
    fontWeight: '700',
  },
  choiceDesc: {
    fontSize: 13,
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
