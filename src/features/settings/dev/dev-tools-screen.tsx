import { router } from 'expo-router';

import { Screen } from '@/components/layout/screen';
import { SettingsGroup, SettingsRow } from '@/features/settings/settings-menu';

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
  return (
    <Screen
      title="Entwickler"
      subtitle="Wähle einen Bereich"
      back={{ label: 'Einstellungen', href: '/settings' }}
      backStyle="icon">
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
