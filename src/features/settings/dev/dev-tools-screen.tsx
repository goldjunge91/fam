import { Redirect, router } from 'expo-router';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Platform } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { type SpeechTestProvider, useDevSettingsStore } from '@/constants/dev-settings';
import { SegmentedControl } from '@/constants/ui';
import { SettingsGroup, SettingsRow } from '@/features/settings/settings-menu';
import { useDevToolsAccess } from '@/hooks/use-dev-tools-access';
import { debugLogEvent } from '@/lib/observability/debug-log';

const SPEECH_PROVIDER_OPTIONS = [
  { value: 'native', labelKey: 'dev.tools.speech.apple' },
  { value: 'whisper', labelKey: 'dev.tools.speech.whisper' },
] as const;

const DEV_CATEGORIES = [
  {
    icon: '🔎',
    labelKey: 'dev.tools.categories.ocr.label',
    hintKey: 'dev.tools.categories.ocr.hint',
    route: '/settings/dev-ocr-inspector',
  },
  {
    icon: '🧭',
    labelKey: 'dev.tools.categories.environment.label',
    hintKey: 'dev.tools.categories.environment.hint',
    route: '/settings/dev-environment',
  },
  {
    icon: '⚙️',
    labelKey: 'dev.tools.categories.overrides.label',
    hintKey: 'dev.tools.categories.overrides.hint',
    route: '/settings/dev-overrides',
  },
  {
    icon: '🤖',
    labelKey: 'dev.tools.categories.models.label',
    hintKey: 'dev.tools.categories.models.hint',
    route: '/settings/dev-ai-models',
  },
  {
    icon: '💾',
    labelKey: 'dev.tools.categories.data.label',
    hintKey: 'dev.tools.categories.data.hint',
    route: '/settings/dev-data',
  },
  {
    icon: '🫀',
    labelKey: 'dev.tools.categories.lifecycle.label',
    hintKey: 'dev.tools.categories.lifecycle.hint',
    route: '/settings/dev-lifecycle',
  },
  {
    icon: '📡',
    labelKey: 'dev.tools.categories.telemetry.label',
    hintKey: 'dev.tools.categories.telemetry.hint',
    route: '/settings/dev-telemetry',
  },
  {
    icon: '🧪',
    labelKey: 'dev.tools.categories.previews.label',
    hintKey: 'dev.tools.categories.previews.hint',
    route: '/settings/dev-previews',
  },
] as const;

export function DevToolsScreen() {
  const { t } = useTranslation();
  const hasAccess = useDevToolsAccess();
  const speechTestProvider = useDevSettingsStore((state) => state.speechTestProvider);
  const setSpeechTestProvider = useDevSettingsStore((state) => state.setSpeechTestProvider);
  const receiptOcrTestEnabled = useDevSettingsStore((state) => state.receiptOcrTestEnabled);
  const receiptOcrProvider = useDevSettingsStore((state) => state.receiptOcrProvider);
  const setReceiptOcrProvider = useDevSettingsStore((state) => state.setReceiptOcrProvider);
  const setReceiptOcrTestEnabled = useDevSettingsStore((state) => state.setReceiptOcrTestEnabled);

  if (!hasAccess) {
    return <Redirect href="/settings" />;
  }

  async function requestMicrophonePermission() {
    try {
      const permission = await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
      debugLogEvent('shopping-list.voice-permission.dev-menu-result', {
        granted: permission.granted,
        status: permission.status,
        canAskAgain: permission.canAskAgain,
      });

      if (permission.granted) {
        Alert.alert(t('dev.tools.microphone.released'), t('dev.tools.microphone.releasedMessage'));
        return;
      }

      if (permission.canAskAgain) {
        Alert.alert(t('dev.tools.microphone.denied'), t('dev.tools.microphone.deniedAgain'));
        return;
      }

      Alert.alert(t('dev.tools.microphone.denied'), t('dev.tools.microphone.deniedPermanent'), [
        { text: t('common.actions.cancel'), style: 'cancel' },
        {
          text: t('dev.tools.microphone.openSettings'),
          onPress: () => void Linking.openSettings(),
        },
      ]);
    } catch (error) {
      debugLogEvent('shopping-list.voice-permission.dev-menu-failed', {
        hasError: Boolean(error),
      });
      Alert.alert(
        t('dev.tools.microphone.unavailable'),
        t('dev.tools.microphone.unavailableMessage'),
      );
    }
  }

  return (
    <Screen
      title={t('dev.tools.title')}
      subtitle={t('dev.tools.subtitle')}
      back={{ label: t('settings.developer.group'), href: '/settings' }}
      backStyle="icon">
      <SettingsGroup title={t('dev.tools.groups.nativePermissions')}>
        <SettingsRow
          icon="🎙️"
          label={t('dev.tools.microphone.release')}
          hint={t('dev.tools.microphone.hint')}
          onPress={() => void requestMicrophonePermission()}
          last
        />
      </SettingsGroup>
      <SettingsGroup title={t('dev.tools.groups.speech')}>
        <SegmentedControl
          label={t('dev.tools.speech.provider')}
          options={SPEECH_PROVIDER_OPTIONS.map(({ value, labelKey }) => ({
            value,
            label: t(labelKey),
          }))}
          selected={speechTestProvider}
          onSelect={(provider) => setSpeechTestProvider(provider as SpeechTestProvider)}
          appearance="surface"
          size="compact"
        />
        <SettingsRow
          icon={speechTestProvider === 'native' ? '🗣️' : '⚡'}
          label={
            speechTestProvider === 'native'
              ? t('dev.tools.speech.appleTest')
              : t('dev.tools.speech.whisperTest')
          }
          hint={
            speechTestProvider === 'native'
              ? t('dev.tools.speech.appleHint')
              : t('dev.tools.speech.whisperHint')
          }
          onPress={() =>
            router.push(
              speechTestProvider === 'native'
                ? '/settings/dev-speech-recognition-example'
                : '/settings/dev-executorch-speech-to-text',
            )
          }
          last
        />
      </SettingsGroup>
      {Platform.OS === 'ios' ? (
        <SettingsGroup title={t('dev.tools.groups.receiptOcr')}>
          <SegmentedControl
            label={t('dev.tools.ocr.provider')}
            options={[
              { value: 'google-mlkit', label: t('dev.tools.ocr.mlKit') },
              { value: 'apple-vision', label: t('dev.tools.ocr.appleVision') },
            ]}
            selected={receiptOcrProvider}
            onSelect={setReceiptOcrProvider}
            appearance="surface"
            size="compact"
          />
          <SegmentedControl
            label={t('dev.tools.ocr.selection')}
            options={[
              { value: 'disabled', label: t('dev.states.off') },
              { value: 'enabled', label: t('dev.states.on') },
            ]}
            selected={receiptOcrTestEnabled ? 'enabled' : 'disabled'}
            onSelect={(value) => setReceiptOcrTestEnabled(value === 'enabled')}
            appearance="surface"
            size="compact"
          />
        </SettingsGroup>
      ) : null}
      <SettingsGroup>
        {DEV_CATEGORIES.map((category, index) => (
          <SettingsRow
            key={category.route}
            icon={category.icon}
            label={t(category.labelKey)}
            hint={t(category.hintKey)}
            onPress={() => router.push(category.route)}
            last={index === DEV_CATEGORIES.length - 1}
          />
        ))}
      </SettingsGroup>
    </Screen>
  );
}
