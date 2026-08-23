import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { deleteLocalDatabase } from '@/lib/db/client';
import { getSupabase } from '@/lib/supabase';

/** Loescht nach nativer Bestaetigung, sofern kein Haushalt den letzten Admin verliert. */
export function DeleteAccountScreen() {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);

  async function performDeletion() {
    setDeleting(true);
    try {
      const { data, error } = await getSupabase().functions.invoke('delete-account', {
        method: 'POST',
      });

      if (error) {
        const status = (error as { context?: { status?: number } }).context?.status;
        if (status === 409) {
          Alert.alert(
            'Noch nicht möglich',
            'Du bist in mindestens einem Haushalt mit weiteren Mitgliedern der letzte ' +
              'Administrator. Übertrage dort zuerst die Administratorrolle oder lösche ' +
              'den Haushalt in den Mitglieder-Einstellungen — danach kannst du deinen ' +
              'Account löschen.',
          );
          return;
        }

        Alert.alert('Löschen fehlgeschlagen', error.message);
        return;
      }

      if (data && (data as { error?: string }).error) {
        Alert.alert(
          'Löschen fehlgeschlagen',
          (data as { message?: string }).message ?? 'Unbekannter Fehler',
        );
        return;
      }

      await queryClient.resetQueries();
      try {
        await deleteLocalDatabase();
      } catch {
        // Lokales Aufraeumen darf eine erfolgreiche Kontoloeschung nicht verschleiern.
      }

      router.replace('/onboarding');
    } catch (err) {
      Alert.alert('Löschen fehlgeschlagen', (err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  function confirmDeletion() {
    Alert.alert(
      'Account wirklich löschen?',
      'Dein Profil, dein Ernährungstagebuch, dein Gewichtsverlauf und deine Ziele ' +
        'werden unwiderruflich gelöscht. Geteilte Haushaltsdaten bleiben für ' +
        'verbleibende Mitglieder bestehen. Das kann nicht rückgängig gemacht werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Endgültig löschen', style: 'destructive', onPress: performDeletion },
      ],
    );
  }

  return (
    <Screen
      title="Konto löschen"
      back={{ label: 'Einstellungen', href: '/settings' }}
      backStyle="icon">
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Löscht deinen Account und alle privaten Daten dauerhaft — Profil, Ernährungstagebuch,
          Gewichtsverlauf und Ziele. Geteilte Haushaltsdaten (z. B. der Kühlschrank-Bestand) bleiben
          für verbleibende Haushaltsmitglieder erhalten. Bist du irgendwo der letzte Administrator
          mit weiteren Mitgliedern, musst du das vorher in den Haushalts-Einstellungen auflösen.
        </ThemedText>
      </Card>
      <View className="mt-four">
        <Button
          label="Account löschen"
          variant="danger"
          onPress={confirmDeletion}
          loading={deleting}
        />
      </View>
    </Screen>
  );
}
