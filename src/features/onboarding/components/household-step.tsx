import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/buttons';
import {
  useCreateHouseholdMutation,
  useHouseholds,
  useRedeemInviteMutation,
} from '@/features/household/api';
import { useOnboarding } from '../context/onboarding-context';
import { validateHouseholdOnboarding } from '../onboarding-helpers';
import type { HouseholdChoice } from '../types';

interface HouseholdStepFormProps {
  onNext: () => void;
  onSkip: () => void;
}

export function HouseholdStepForm({ onNext, onSkip }: HouseholdStepFormProps) {
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
    // Der äußere `Screen`-Wrapper bekommt für diesen Schritt `scroll={false}`
    // (siehe onboarding-flow.tsx), damit diese ScrollView die einzige im
    // Baum ist. Weder `KeyboardAvoidingView` noch `automaticallyAdjustKeyboardInsets`
    // scrollten hier zuverlässig zum fokussierten Feld — `KeyboardAwareScrollView`
    // aus react-native-keyboard-controller (offizieller Expo-Doku-Weg für
    // Formulare in einer ScrollView) übernimmt das nativ und konsistent auf
    // iOS und Android.
    <KeyboardAwareScrollView
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerClassName="gap-three pb-six">
      <Text className="perm-heading">Dein Haushalt</Text>
      <Text className="perm-subheading">
        Entscheide, wie du die App für Vorrat & Einkäufe nutzen möchtest.
      </Text>

      {/* Aktiver Haushalt Banner */}
      {activeHousehold ? (
        <View className="household-active-card">
          <Text className="household-active-badge">✓ Aktiver Haushalt erkannt</Text>
          <Text className="household-active-title">{activeHousehold.name}</Text>
        </View>
      ) : null}

      <View className="perm-list">
        <Pressable
          onPress={() => setChoice('create')}
          className={`household-choice-card ${choice === 'create' ? 'household-choice-card-selected' : 'household-choice-card-idle'}`}>
          <Text
            className={`household-choice-title ${choice === 'create' ? 'text-on-accent' : 'text-text'}`}>
            🏠 Neuen Haushalt erstellen
          </Text>
          <Text
            className={`household-choice-desc ${choice === 'create' ? 'text-on-accent' : 'text-text-secondary'}`}>
            Erstelle eine eigene Gruppe für deine Familie oder WG und lade Mitglieder ein.
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setChoice('join')}
          className={`household-choice-card ${choice === 'join' ? 'household-choice-card-selected' : 'household-choice-card-idle'}`}>
          <Text
            className={`household-choice-title ${choice === 'join' ? 'text-on-accent' : 'text-text'}`}>
            🔗 Einem Haushalt beitreten
          </Text>
          <Text
            className={`household-choice-desc ${choice === 'join' ? 'text-on-accent' : 'text-text-secondary'}`}>
            Gib den Einladungscode ein, den du erhalten hast.
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setChoice('solo')}
          className={`household-choice-card ${choice === 'solo' ? 'household-choice-card-selected' : 'household-choice-card-idle'}`}>
          <Text
            className={`household-choice-title ${choice === 'solo' ? 'text-on-accent' : 'text-text'}`}>
            👤{' '}
            {activeHousehold
              ? `Mit "${activeHousehold.name}" fortfahren`
              : 'Vorerst alleine nutzen'}
          </Text>
          <Text
            className={`household-choice-desc ${choice === 'solo' ? 'text-on-accent' : 'text-text-secondary'}`}>
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
          label="Einladungs-Code"
          value={inviteCode}
          onChangeText={setInviteCode}
          // Tokens sind volle UUIDs (siehe household_invites.token,
          // invite-modal.tsx zeigt sie so an) — kein 6-stelliges Kurzformat.
          placeholder="z. B. 123e4567-e89b-12d3-a456-426614174000"
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}

      {errorMsg ? <Text className="household-error-text">{errorMsg}</Text> : null}

      <View className="perm-button-row">
        <View className="flex-1">
          <Button label="Weiter" onPress={handleNext} loading={isPending} />
        </View>
        <View className="flex-1">
          <Button label="Überspringen" variant="secondary" onPress={onSkip} disabled={isPending} />
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
