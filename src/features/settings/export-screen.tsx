import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { useSession } from '@/features/auth/session-provider';
import { buildUserDataExport } from '@/features/settings/data-export';

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
      {/* Hinweiskarte zum DSGVO-Datenexportumfang */}
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Exportiert dein Profil, deine Ziele, das Ernährungstagebuch, deinen Gewichtsverlauf und
          deine Haushaltsmitgliedschaften als JSON-Datei — keine Daten anderer Haushaltsmitglieder.
          Die Datei ist auch ohne die App lesbar.
        </ThemedText>
      </Card>
      {/* Export-Aktionsbutton */}
      <View className="mt-four">
        <Button label="Daten exportieren" onPress={handleExport} loading={exporting} />
      </View>
    </Screen>
  );
}
