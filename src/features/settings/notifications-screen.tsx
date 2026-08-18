import { Screen } from '@/components/layout/screen';
import { NotificationSettingsCard } from '@/features/settings/notification-settings-card';

/**
 * Eigene Seite fuer die Benachrichtigungen.
 *
 * Die Karte selbst ist unveraendert — sie stand vorher mitten in der langen
 * Einstellungsseite zwischen Lagerorten und Synchronisation. Mit Schalter,
 * Schwellenwert und Uhrzeit ist sie das laengste Formular dort gewesen und der
 * Hauptgrund, warum die Uebersicht gescrollt werden musste.
 */
export function NotificationsScreen() {
  return (
    <Screen
      title="Benachrichtigungen"
      back={{ label: 'Einstellungen', href: '/settings' }}
      backStyle="icon">
      <NotificationSettingsCard />
    </Screen>
  );
}
