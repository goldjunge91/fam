import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Button, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { buildUserDataExport } from '@/features/settings/data-export';

export function ExportScreen() {
  const { t } = useTranslation();
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
          dialogTitle: t('settings.groups.data.export.shareDialogTitle'),
        });
      } else {
        Alert.alert(
          t('settings.groups.data.export.createdTitle'),
          t('settings.groups.data.export.createdBody', { path: file.uri }),
        );
      }
    } catch (error) {
      Alert.alert(t('settings.groups.data.export.failedTitle'), (error as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Screen
      title={t('settings.groups.data.export.label')}
      back={{ label: t('settings.backToSettings'), href: '/settings' }}
      backStyle="icon">
      {/* Hinweiskarte zum DSGVO-Datenexportumfang */}
      <Card>
        <Txt variant="body" tone="secondary">
          {t('settings.groups.data.export.hint')}
        </Txt>
      </Card>
      {/* Export-Aktionsbutton */}
      <View className="mt-four">
        <Button
          title={t('settings.groups.data.export.exportButton')}
          onPress={handleExport}
          loading={exporting}
        />
      </View>
    </Screen>
  );
}
