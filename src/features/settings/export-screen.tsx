import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { buildUserDataExport } from '@/features/settings/data-export';

/**
 * Datenexport (#97, DSGVO Art. 20). `expo-file-system`/`expo-sharing` per
 * `require()` erst hier geladen — natives Modul, dasselbe Muster wie
 * `off-dump.ts`, damit ein Test, der diese Datei transitiv importiert, nicht
 * ohne Development Build crasht.
 */
export function ExportScreen() {
  const { session } = useSession();
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    const userId = session?.user.id;
    if (!userId || exporting) return;

    setExporting(true);
    try {
      const data = await buildUserDataExport(userId);
      const json = JSON.stringify(data, null, 2);

      const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
      const Sharing = require('expo-sharing') as typeof import('expo-sharing');

      const dateStamp = new Date().toISOString().slice(0, 10);
      const file = new File(Paths.cache, `fam-export-${dateStamp}.json`);
      if (file.exists) file.delete();
      file.write(json);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Daten exportieren',
        });
      } else {
        Alert.alert('Export erstellt', `Datei liegt unter ${file.uri}`);
      }
    } catch (error) {
      Alert.alert('Export fehlgeschlagen', (error as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Screen title="Export" back={{ label: 'Einstellungen', href: '/settings' }} backStyle="icon">
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Exportiert dein Profil, deine Ziele, das Ernährungstagebuch, deinen Gewichtsverlauf und
          deine Haushaltsmitgliedschaften als JSON-Datei — keine Daten anderer Haushaltsmitglieder.
          Die Datei ist auch ohne die App lesbar.
        </ThemedText>
      </Card>
      <View style={styles.action}>
        <Button label="Daten exportieren" onPress={handleExport} loading={exporting} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: {
    marginTop: Spacing.four,
  },
});
