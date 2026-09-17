import { router } from 'expo-router';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Alert, Linking } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { SettingsGroup, SettingsRow } from '@/features/settings/settings-menu';
import { debugLogEvent } from '@/lib/observability/debug-log';

const DEV_CATEGORIES = [
  {
    icon: '🧭',
    label: 'Umgebung & Zugang',
    hint: 'Build, Dienste, Session und Haushalt',
    route: '/settings/dev-environment',
  },
  {
    icon: '⚙️',
    label: 'Overrides & Feature-Konfiguration',
    hint: 'Premium, Flags, Analytics und Tracking',
    route: '/settings/dev-overrides',
  },
  {
    icon: '💾',
    label: 'Daten & Synchronisation',
    hint: 'Lokale Datenbank, Dump und Outbox',
    route: '/settings/dev-data',
  },
  {
    icon: '📡',
    label: 'Telemetrie & Plattformtests',
    hint: 'Testsignale, Benachrichtigungen und Logs',
    route: '/settings/dev-telemetry',
  },
  {
    icon: '🧪',
    label: 'Vorschauen & Labs',
    hint: 'Design-System, Auth, Drax und Paywalls',
    route: '/settings/dev-previews',
  },
] as const;

export function DevToolsScreen() {
  async function requestMicrophonePermission() {
    try {
      const permission = await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
      debugLogEvent('shopping-list.voice-permission.dev-menu-result', {
        granted: permission.granted,
        status: permission.status,
        canAskAgain: permission.canAskAgain,
      });

      if (permission.granted) {
        Alert.alert('Mikrofon freigegeben', 'Die Spracheingabe kann das Mikrofon verwenden.');
        return;
      }

      if (permission.canAskAgain) {
        Alert.alert(
          'Mikrofon nicht freigegeben',
          'iOS hat den Zugriff noch nicht freigegeben. Tippe erneut, um die Abfrage zu öffnen.',
        );
        return;
      }

      Alert.alert(
        'Mikrofon nicht freigegeben',
        'Die Berechtigung wurde dauerhaft abgelehnt. Öffne die iOS-Einstellungen und erlaube den Mikrofonzugriff für fam.',
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Einstellungen öffnen', onPress: () => void Linking.openSettings() },
        ],
      );
    } catch (error) {
      debugLogEvent('shopping-list.voice-permission.dev-menu-failed', {
        hasError: Boolean(error),
      });
      Alert.alert(
        'Mikrofonberechtigung nicht verfügbar',
        'Der aktuelle Build stellt das native Speech-Modul nicht bereit.',
      );
    }
  }

  return (
    <Screen
      title="Entwickler"
      subtitle="Wähle einen Bereich"
      back={{ label: 'Einstellungen', href: '/settings' }}
      backStyle="icon">
      <SettingsGroup title="Native Berechtigungen">
        <SettingsRow
          icon="🎙️"
          label="Mikrofon freigeben"
          hint="Öffnet die iOS-Abfrage für die Spracheingabe"
          onPress={() => void requestMicrophonePermission()}
          last
        />
      </SettingsGroup>
      <SettingsGroup title="Spracheingabe">
        <SettingsRow
          icon="🛒"
          label="Shopping-List-Preview öffnen"
          hint="Produktives Zuordnungsmodal ohne Mikrofon testen"
          onPress={() => router.push('/shopping-list?action=preview')}
        />
        <SettingsRow
          icon="🗣️"
          label="Expo Speech Example"
          hint="Direkten Referenzpfad des Pakets testen"
          onPress={() => router.push('/settings/dev-speech-recognition-example')}
        />
        <SettingsRow
          icon="⚡"
          label="ExecuTorch Speech-to-Text"
          hint="Whisper Tiny lokal auf einem echten Gerät testen"
          onPress={() => router.push('/settings/dev-executorch-speech-to-text')}
          last
        />
      </SettingsGroup>
      <SettingsGroup>
        {DEV_CATEGORIES.map((category, index) => (
          <SettingsRow
            key={category.route}
            icon={category.icon}
            label={category.label}
            hint={category.hint}
            onPress={() => router.push(category.route)}
            last={index === DEV_CATEGORIES.length - 1}
          />
        ))}
      </SettingsGroup>
    </Screen>
  );
}
