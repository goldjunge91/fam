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
  const { data: households, isLoading: householdsLoading } = useHouseholds();
  const currentHousehold = households?.[0];
  const createHouseholdMutation = useCreateHouseholdMutation();
  const redeemInviteMutation = useRedeemInviteMutation();

  const [householdName, setHouseholdName] = useState('');
  const [householdError, setHouseholdError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemedStatus, setRedeemedStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!currentHousehold) {
      consumePendingInviteToken().then(async (pendingToken) => {
        if (pendingToken) {
          try {
            setRedeeming(true);
            await redeemInviteMutation.mutateAsync(pendingToken);
            setRedeemedStatus('Erfolgreich dem Haushalt beigetreten!');
          } catch (err) {
            console.error('Fehler beim automatischen Einlösen der Einladung:', err);
          } finally {
            setRedeeming(false);
          }
        }
      });
    }
  }, [currentHousehold, redeemInviteMutation]);

  async function handleCreateHousehold() {
    if (currentHousehold) {
      onNext();
      return;
    }

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
    <Card title="Schritt 5: Haushalt">
      {currentHousehold ? (
        <View style={styles.form}>
          <View style={styles.successBanner}>
            <ThemedText style={styles.successBadge}>🎉 Erfolgreich beigetreten!</ThemedText>
            <ThemedText type="subtitle" style={{ fontSize: 18, marginTop: 4 }}>
              {currentHousehold.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>
              Du bist Mitglied im Haushalt &quot;{currentHousehold.name}&quot;. Du musst keinen
              neuen Haushalt erstellen.
            </ThemedText>
          </View>
          <Button label="Weiter zu Schritt 6" onPress={onNext} />
        </View>
      ) : (
        <View style={styles.form}>
          {redeeming ? (
            <ThemedText type="small" themeColor="accent">
              ⏳ Einladungs-Token wird eingelöst...
            </ThemedText>
          ) : redeemedStatus ? (
            <ThemedText type="smallBold" themeColor="accent">
              ✓ {redeemedStatus}
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Erstelle deinen ersten Haushalt (z.B. &quot;WG Müller&quot; oder &quot;Familie
              Schmidt&quot;).
            </ThemedText>
          )}

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
            loading={createHouseholdMutation.isPending || householdsLoading || redeeming}
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
  successBanner: {
    padding: Spacing.three,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: '#10B981',
    gap: 4,
  },
  successBadge: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981',
  },
});
