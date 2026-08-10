import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useRedeemInviteMutation } from '@/features/household/api';
import { clearPendingInviteToken, peekPendingInviteToken } from '@/lib/pending-invite';

export function JoinHouseholdScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [tokenInput, setTokenInput] = useState(params.token ?? '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const redeemMutation = useRedeemInviteMutation();

  useEffect(() => {
    // Nicht-destruktiv lesen (#128): Bricht der Nutzer hier ab, ohne
    // "Beitreten" zu tippen, bleibt der Token fuer einen spaeteren Versuch
    // erhalten statt beim blossen Anzeigen des Screens verloren zu gehen.
    if (!params.token) {
      peekPendingInviteToken().then((pending) => {
        if (pending) {
          setTokenInput(pending);
        }
      });
    }
  }, [params.token]);

  async function handleJoin() {
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      setErrorMsg('Bitte gib einen Einladungs-Code ein.');
      return;
    }

    setErrorMsg(null);
    try {
      await redeemMutation.mutateAsync(trimmed);
      await clearPendingInviteToken();
      router.replace('/');
    } catch (err) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Einladung konnte nicht eingelöst werden.');
      }
    }
  }

  return (
    <Screen
      title="Haushalt beitreten"
      subtitle="Mit Einladungs-Code oder Link"
      back={{ label: 'Einstellungen', href: '/settings' }}>
      <Card title="Einlösung">
        <View style={styles.form}>
          <TextField
            label="Einladungs-Code / Token"
            placeholder="z. B. 123e4567-e89b-12d3-a456-426614174000"
            value={tokenInput}
            onChangeText={setTokenInput}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {errorMsg ? (
            <ThemedText type="small" themeColor="danger">
              {errorMsg}
            </ThemedText>
          ) : null}

          <Button
            label="Haushalt beitreten"
            onPress={handleJoin}
            loading={redeemMutation.isPending}
            disabled={!tokenInput.trim()}
          />
        </View>
      </Card>

      <View style={{ marginTop: Spacing.four }}>
        <Button label="Abbrechen" variant="secondary" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
});
