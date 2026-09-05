import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/buttons';
import { Txt } from '@/constants/ui';
import {
  useCreateHouseholdMutation,
  useHouseholds,
  useRedeemInviteMutation,
} from '@/features/household/api';
import { validateHouseholdOnboarding } from '../onboarding-helpers';
import { useOnboarding } from '../onboarding-store';
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
    // Eigene KeyboardAwareScrollView für den Haushalts-Schritt.
    <KeyboardAwareScrollView
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerClassName="gap-three pb-six">
      <Txt variant="subheading" weight="700">
        Dein Haushalt
      </Txt>
      <Txt variant="body" tone="secondary">
        Entscheide, wie du die App für Vorrat & Einkäufe nutzen möchtest.
      </Txt>

      {/* Aktiver Haushalt Banner */}
      {activeHousehold ? (
        <View className="household-active-card">
          <Txt variant="label" tone="success" weight="700" className="uppercase tracking-[0.5px]">
            ✓ Aktiver Haushalt erkannt
          </Txt>
          <Txt variant="body" weight="700">
            {activeHousehold.name}
          </Txt>
        </View>
      ) : null}

      <View className="perm-list">
        <Pressable
          onPress={() => setChoice('create')}
          className={`household-choice-card ${choice === 'create' ? 'household-choice-card-selected' : 'household-choice-card-idle'}`}>
          <Txt variant="body" tone={choice === 'create' ? 'onAccent' : 'primary'} weight="700">
            🏠 Neuen Haushalt erstellen
          </Txt>
          <Txt variant="label" tone={choice === 'create' ? 'onAccent' : 'secondary'}>
            Erstelle eine eigene Gruppe für deine Familie oder WG und lade Mitglieder ein.
          </Txt>
        </Pressable>

        <Pressable
          onPress={() => setChoice('join')}
          className={`household-choice-card ${choice === 'join' ? 'household-choice-card-selected' : 'household-choice-card-idle'}`}>
          <Txt variant="body" tone={choice === 'join' ? 'onAccent' : 'primary'} weight="700">
            🔗 Einem Haushalt beitreten
          </Txt>
          <Txt variant="label" tone={choice === 'join' ? 'onAccent' : 'secondary'}>
            Gib den Einladungscode ein, den du erhalten hast.
          </Txt>
        </Pressable>

        <Pressable
          onPress={() => setChoice('solo')}
          className={`household-choice-card ${choice === 'solo' ? 'household-choice-card-selected' : 'household-choice-card-idle'}`}>
          <Txt variant="body" tone={choice === 'solo' ? 'onAccent' : 'primary'} weight="700">
            👤{' '}
            {activeHousehold
              ? `Mit "${activeHousehold.name}" fortfahren`
              : 'Vorerst alleine nutzen'}
          </Txt>
          <Txt variant="label" tone={choice === 'solo' ? 'onAccent' : 'secondary'}>
            {activeHousehold
              ? 'Behalte deinen bestehenden Haushalt und fahre fort.'
              : 'Starte mit einem privaten Bereich. Du kannst jederzeit andere einladen.'}
          </Txt>
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

      {errorMsg ? (
        <Txt variant="label" tone="danger" className="mt-one">
          {errorMsg}
        </Txt>
      ) : null}

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
