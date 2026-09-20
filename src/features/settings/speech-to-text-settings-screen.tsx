import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Screen } from '@/components/layout/screen';
import { AutoAssignSetting } from '@/features/settings/auto-assign-setting';
import { SettingsGroup, SettingsRow } from '@/features/settings/settings-menu';
import { SpeechRecognitionPermissionSetting } from '@/features/settings/speech-recognition-permission-setting';

const styles = StyleSheet.create((theme) => ({
  content: {
    gap: theme.space.lg,
  },
}));

export function SpeechToTextSettingsScreen() {
  const { t } = useTranslation();

  return (
    <Screen
      title={t('settings.groups.speechToText.title')}
      back={{ label: t('settings.backToSettings'), href: '/settings' }}
      backStyle="icon">
      <View style={styles.content}>
        <SettingsGroup>
          <AutoAssignSetting />
          <SettingsRow
            icon="🗣️"
            label={t('settings.groups.app.naturalLanguageBeta.corrections.label')}
            hint={t('settings.groups.app.naturalLanguageBeta.corrections.hint')}
            onPress={() => router.push('/settings/speech-corrections')}
            last={Platform.OS !== 'ios'}
          />
          {Platform.OS === 'ios' ? <SpeechRecognitionPermissionSetting /> : null}
        </SettingsGroup>
      </View>
    </Screen>
  );
}
