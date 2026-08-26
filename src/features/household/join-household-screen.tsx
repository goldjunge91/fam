import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { useRedeemInviteMutation } from '@/features/household/api';
import { trackAptabaseEvent } from '@/lib/analytics/aptabase';
import { clearPendingInviteToken, peekPendingInviteToken } from '@/lib/pending-invite';

export function JoinHouseholdScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [tokenInput, setTokenInput] = useState(params.token ?? '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const redeemMutation = useRedeemInviteMutation();

  useEffect(() => {
    // Token erst beim erfolgreichen Beitritt entfernen.
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
      trackAptabaseEvent('household_joined');
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
      back={{ label: 'Haushalte' }}
      backStyle="icon">
      {/* Eingabe-Formular für den Einladungs-Code / Token */}
      <Card title="Einlösung">
        <View className="gap-three">
          {/* Eingabefeld für Einladungs-Token */}
          <TextField
            label="Einladungs-Code / Token"
            placeholder="z. B. 123e4567-e89b-12d3-a456-426614174000"
            value={tokenInput}
            onChangeText={setTokenInput}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Fehleranzeige bei ungültigem / abgelaufenem Code */}
          {errorMsg ? <ThemedText type="smallDanger">{errorMsg}</ThemedText> : null}

          {/* Beitreten-Aktionsbutton */}
          <Button
            label="Haushalt beitreten"
            onPress={handleJoin}
            loading={redeemMutation.isPending}
            disabled={!tokenInput.trim()}
          />
        </View>
      </Card>

      {/* Abbrechen-Button (sofern Historie vorhanden) */}
      {router.canGoBack() && (
        <Button label="Abbrechen" variant="secondary" onPress={() => router.back()} />
      )}
    </Screen>
  );
}
