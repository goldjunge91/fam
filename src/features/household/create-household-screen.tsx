import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCreateHouseholdMutation } from '@/features/household/api';

export function CreateHouseholdScreen() {
  const [householdName, setHouseholdName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mutation = useCreateHouseholdMutation();
  const queryClient = useQueryClient();

  async function handleSubmit() {
    const trimmed = householdName.trim();
    if (!trimmed) {
      setErrorMsg('Bitte gib einen Namen für den Haushalt ein.');
      return;
    }

    setErrorMsg(null);
    try {
      await mutation.mutateAsync(trimmed);
      await queryClient.refetchQueries({ queryKey: ['households'] });
      // Nach der Erstellung routen wir ins Dashboard.
      // Falls der Nutzer von der "Kein Haushalt"-Weiche kam, greift nun die App.
      router.replace('/');
    } catch (err) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Ein unerwarteter Fehler ist aufgetreten.');
      }
    }
  }

  return (
    <Screen title="Haushalt erstellen" subtitle="Lade später deine Familie oder WG ein">
      <Card>
        <View style={styles.form}>
          <TextField
            label="Name deines Haushalts"
            value={householdName}
            onChangeText={setHouseholdName}
            placeholder="z. B. WG Müller"
            autoCapitalize="words"
          />

          {errorMsg ? (
            <ThemedText type="small" themeColor="danger">
              {errorMsg}
            </ThemedText>
          ) : null}

          <Button label="Erstellen" onPress={handleSubmit} loading={mutation.isPending} />
        </View>
      </Card>

      {router.canGoBack() && (
        <Button label="Abbrechen" variant="secondary" onPress={() => router.back()} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
});
