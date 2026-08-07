import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  useCreateHouseholdMutation,
  useHouseholds,
  useRedeemInviteMutation,
} from '@/features/household/api';
import { consumePendingInviteToken } from '@/lib/pending-invite';

export function StepCreateHousehold({ onNext }: { onNext: () => void }) {
  const { data: households } = useHouseholds();
  const currentHousehold = households?.[0];
  const createHouseholdMutation = useCreateHouseholdMutation();
  const redeemInviteMutation = useRedeemInviteMutation();

  const [householdName, setHouseholdName] = useState('');
  const [householdError, setHouseholdError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentHousehold) {
      consumePendingInviteToken().then(async (pendingToken) => {
        if (pendingToken) {
          try {
            await redeemInviteMutation.mutateAsync(pendingToken);
          } catch (err) {
            console.error('Fehler beim automatischen Einlösen der Einladung:', err);
          }
        }
      });
    }
  }, [currentHousehold, redeemInviteMutation]);

  async function handleCreateHousehold() {
    const trimmed = householdName.trim();
    if (!trimmed) {
      setHouseholdError('Bitte gib einen Namen für den Haushalt ein.');
      return;
    }
    setHouseholdError(null);
    try {
      await createHouseholdMutation.mutateAsync(trimmed);
      onNext();
    } catch (err) {
      if (err instanceof Error) {
        setHouseholdError(err.message);
      } else {
        setHouseholdError('Fehler beim Erstellen des Haushalts.');
      }
    }
  }

  return (
    <Card title="Schritt 5: Haushalt erstellen">
      {currentHousehold ? (
        <View style={styles.form}>
          <ThemedText type="smallBold" themeColor="accent">
            ✓ Aktueller Haushalt: {currentHousehold.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Du bist Mitglied im Haushalt &quot;{currentHousehold.name}&quot;. Du kannst nun dein
            Profil ausfüllen.
          </ThemedText>
          <Button label="Weiter zu Schritt 6" onPress={onNext} />
        </View>
      ) : (
        <View style={styles.form}>
          <ThemedText type="small" themeColor="textSecondary">
            Erstelle deinen ersten Haushalt (z.B. &quot;WG Müller&quot; oder &quot;Familie
            Schmidt&quot;).
          </ThemedText>
          <TextField
            label="Name deines Haushalts"
            value={householdName}
            onChangeText={setHouseholdName}
            placeholder="z. B. WG Müller"
            autoCapitalize="words"
          />

          {householdError ? (
            <ThemedText type="small" themeColor="danger">
              {householdError}
            </ThemedText>
          ) : null}

          <Button
            label="Haushalt erstellen & weiter"
            onPress={handleCreateHousehold}
            loading={createHouseholdMutation.isPending}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
});
