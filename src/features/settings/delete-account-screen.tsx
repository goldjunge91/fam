import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { deleteLocalDatabase } from '@/lib/db/client';
import { getSupabase } from '@/lib/supabase';

/**
 * Account- und Datenloeschung (#98). Zwei-Schritt-Bestaetigung: der Danger-
 * Button oeffnet einen nativen `Alert`, erst dessen destruktive Option loest
 * die eigentliche Loeschung aus.
 *
 * Die Edge Function `delete-account` prueft serverseitig zuerst
 * `prepare_account_deletion()` — ist dieser Nutzer irgendwo der letzte Admin
 * mit weiteren Mitgliedern, kommt ein 409 mit `last_admin_with_members`
 * zurueck, statt irgendetwas zu loeschen. Die Aufloesung (Admin uebertragen
 * oder den betroffenen Haushalt loeschen) passiert auf der bestehenden
 * Mitgliederseite (`/household/members`), nicht hier noch einmal.
 */
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
        // Session ist zu diesem Zeitpunkt bereits ungueltig (Konto weg) — ein
        // Fehler beim lokalen Aufraeumen darf den Erfolg nicht verschleiern.
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
      <View style={styles.action}>
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

const styles = StyleSheet.create({
  action: {
    marginTop: Spacing.four,
  },
});
