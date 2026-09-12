import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Button, Txt } from '@/constants/ui';
import { showAdsPrivacyOptions } from '@/features/ads';

// Reihenfolge und Inhalt der Abschnitte in settings.groups.data.privacy.sections.
// Gekürzte In-App-Fassung von docs/architecture/DATENSCHUTZ.md. Volltext dort pflegen und
// bei inhaltlichen Änderungen hier nachziehen (#96).
const SECTION_KEYS = [
  'dataProtection',
  'dataProcessed',
  'thirdParties',
  'permissions',
  'adsAndTracking',
  'yourRights',
] as const;

export function PrivacyScreen() {
  const { t } = useTranslation();
  const [privacyOptionsLoading, setPrivacyOptionsLoading] = useState(false);

  async function handleAdsPrivacyOptions() {
    if (privacyOptionsLoading) return;
    setPrivacyOptionsLoading(true);

    try {
      const opened = await showAdsPrivacyOptions();
      if (!opened) {
        Alert.alert(
          t('settings.groups.data.privacy.adsSettings.noOptionsTitle'),
          t('settings.groups.data.privacy.adsSettings.noOptionsBody'),
        );
      }
    } catch {
      Alert.alert(
        t('settings.groups.data.privacy.adsSettings.errorTitle'),
        t('settings.groups.data.privacy.adsSettings.errorBody'),
      );
    } finally {
      setPrivacyOptionsLoading(false);
    }
  }

  return (
    <Screen
      title={t('settings.groups.data.privacy.title')}
      back={{ label: t('settings.backToSettings'), href: '/settings' }}
      backStyle="icon">
      <View className="gap-three">
        {SECTION_KEYS.map((key) => (
          <Card key={key}>
            {/* Die Card-Komponente setzt den Abstand zwischen Titel und Text. */}
            <Txt variant="body" weight="700">
              {t(`settings.groups.data.privacy.sections.${key}.title`)}
            </Txt>
            <Txt variant="body" tone="secondary">
              {t(`settings.groups.data.privacy.sections.${key}.body`)}
            </Txt>
          </Card>
        ))}
        <Card>
          <Txt variant="body" weight="700">
            {t('settings.groups.data.privacy.adsSettings.title')}
          </Txt>
          <Txt variant="body" tone="secondary">
            {t('settings.groups.data.privacy.adsSettings.description')}
          </Txt>
          <Button
            title={t('settings.groups.data.privacy.adsSettings.openButton')}
            variant="secondary"
            size="sm"
            loading={privacyOptionsLoading}
            onPress={handleAdsPrivacyOptions}
          />
        </Card>
      </View>
    </Screen>
  );
}
