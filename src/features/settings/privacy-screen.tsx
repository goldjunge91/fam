import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
import { useAnalyticsSettingsStore } from '@/constants/analytics';
import { Button, Txt } from '@/constants/ui';
import { showAdsPrivacyOptions } from '@/features/ads';

const styles = StyleSheet.create((theme) => ({
  sectionList: {
    gap: theme.space.lg,
  },
}));

// Reihenfolge und Inhalt der Abschnitte in settings.groups.data.privacy.sections.
// Gekürzte In-App-Fassung von docs/architecture/DATENSCHUTZ.md. Volltext dort pflegen und
// bei inhaltlichen Änderungen hier nachziehen (#96).
const SECTION_KEYS = [
  'dataProtection',
  'dataProcessed',
  'thirdParties',
  'aiProcessing',
  'permissions',
  'adsAndTracking',
  'yourRights',
] as const;

export function PrivacyScreen() {
  const { t } = useTranslation();
  const [privacyOptionsLoading, setPrivacyOptionsLoading] = useState(false);
  const posthogConsent = useAnalyticsSettingsStore((state) => state.posthogConsent);
  const setPostHogConsent = useAnalyticsSettingsStore((state) => state.setPostHogConsent);

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

  function handlePostHogConsentChange() {
    setPostHogConsent(posthogConsent === 'granted' ? 'denied' : 'granted');
  }

  return (
    <Screen
      title={t('settings.groups.data.privacy.title')}
      back={{ label: t('settings.backToSettings'), href: '/settings' }}
      backStyle="icon">
      <View style={styles.sectionList}>
        {SECTION_KEYS.map((key) => (
          <ContentCard key={key}>
            {/* Die Card-Komponente setzt den Abstand zwischen Titel und Text. */}
            <Txt variant="body" weight="700">
              {t(`settings.groups.data.privacy.sections.${key}.title`)}
            </Txt>
            <Txt variant="body" tone="secondary">
              {t(`settings.groups.data.privacy.sections.${key}.body`)}
            </Txt>
          </ContentCard>
        ))}
        <ContentCard>
          <Txt variant="body" weight="700">
            {t('settings.groups.data.privacy.posthogSettings.title')}
          </Txt>
          <Txt variant="body" tone="secondary">
            {t(
              posthogConsent === 'granted'
                ? 'settings.groups.data.privacy.posthogSettings.enabledDescription'
                : 'settings.groups.data.privacy.posthogSettings.disabledDescription',
            )}
          </Txt>
          <Button
            title={t(
              posthogConsent === 'granted'
                ? 'settings.groups.data.privacy.posthogSettings.disableButton'
                : 'settings.groups.data.privacy.posthogSettings.allowButton',
            )}
            variant="secondary"
            size="sm"
            onPress={handlePostHogConsentChange}
          />
        </ContentCard>
        <ContentCard>
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
        </ContentCard>
      </View>
    </Screen>
  );
}
