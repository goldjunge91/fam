import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { Txt } from '@/constants/ui';
import { signOutAndClearLocalData } from '@/features/auth/sign-out';
import { getSupabase } from '@/lib/supabase';

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

      const { error: signOutError } = await signOutAndClearLocalData(queryClient);
      if (signOutError) throw signOutError;

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
      {/* Warnhinweis-Karte zu den Auswirkungen der Account-Löschung */}
      <Card>
        <Txt variant="body" tone="secondary" weight="500">
          Löscht deinen Account und alle privaten Daten dauerhaft — Profil, Ernährungstagebuch,
          Gewichtsverlauf und Ziele. Geteilte Haushaltsdaten (z. B. der Kühlschrank-Bestand) bleiben
          für verbleibende Haushaltsmitglieder erhalten. Bist du irgendwo der letzte Administrator
          mit weiteren Mitgliedern, musst du das vorher in den Haushalts-Einstellungen auflösen.
        </Txt>
      </Card>
      {/* Gefahren-Aktionsbutton zum Einleiten der Kontolöschung */}
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
