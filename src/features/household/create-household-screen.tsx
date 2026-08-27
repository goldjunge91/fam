import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { useCreateHouseholdMutation } from '@/features/household/api';

export function CreateHouseholdScreen() {
  const [householdName, setHouseholdName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mutation = useCreateHouseholdMutation();

  async function handleSubmit() {
    const trimmed = householdName.trim();
    if (!trimmed) {
      setErrorMsg('Bitte gib einen Namen für den Haushalt ein.');
      return;
    }

    setErrorMsg(null);
    try {
      // `useCreateHouseholdMutation`s onSuccess pullt den neuen Haushalt
      // bereits in den lokalen Spiegel und invalidiert die Query, bevor
      // dieses mutateAsync aufloest — kein zusaetzlicher Refetch noetig.
      await mutation.mutateAsync(trimmed);
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
    <Screen
      title="Haushalt erstellen"
      subtitle="Lade später deine Familie oder WG ein"
      back={{ label: 'Haushalte' }}>
      {/* Formular zur Erstellung eines neuen Haushalts */}
      <Card>
        <View className="gap-three">
          {/* Eingabefeld für Haushaltsname */}
          <TextField
            label="Name deines Haushalts"
            value={householdName}
            onChangeText={setHouseholdName}
            placeholder="z. B. WG Müller"
            autoCapitalize="words"
          />

          {/* Validierungs- und Serverfehler */}
          {errorMsg ? <ThemedText type="smallDanger">{errorMsg}</ThemedText> : null}

          {/* Erstellen-Button */}
          <Button label="Erstellen" onPress={handleSubmit} loading={mutation.isPending} />
        </View>
      </Card>

      {/* Alternative Aktion: Haushalts-Beitritt via Code */}
      <Button
        label="Ich habe einen Einladungs-Code"
        variant="secondary"
        onPress={() => router.push('/household/join')}
      />

      {/* Abbrechen-Button (sofern Historie vorhanden) */}
      {router.canGoBack() && (
        <Button label="Abbrechen" variant="secondary" onPress={() => router.back()} />
      )}
    </Screen>
  );
}
