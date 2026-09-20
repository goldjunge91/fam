import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { SettingsRow } from '@/features/settings/settings-menu';
import { useSpeechRecognizerPermission } from '@/features/shopping-list/stt-beta/services/speech-recognizer-permissions';

export function SpeechRecognitionPermissionSetting() {
  const { t } = useTranslation();
  const [permission, requestPermission] = useSpeechRecognizerPermission();

  const isLoading = permission === null;
  const canAskAgain = permission?.canAskAgain ?? true;

  async function handlePress() {
    if (isLoading) return;
    if (permission.granted || !canAskAgain) {
      await Linking.openSettings();
      return;
    }
    await requestPermission();
  }

  const value = isLoading
    ? t('settings.groups.speechToText.permission.status.loading')
    : permission.granted
      ? t('settings.groups.speechToText.permission.status.on')
      : t('settings.groups.speechToText.permission.status.off');

  return (
    <SettingsRow
      icon="☁️"
      label={t('settings.groups.speechToText.permission.label')}
      hint={
        canAskAgain
          ? t('settings.groups.speechToText.permission.hint')
          : t('settings.groups.app.permissions.deniedHint')
      }
      value={value}
      onPress={() => void handlePress()}
      disabled={isLoading}
      last
    />
  );
}
