import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { Txt } from '@/constants/ui';
import { showAdsPrivacyOptions } from '@/features/ads';

type Section = {
  title: string;
  body: string;
};

// Gekürzte In-App-Fassung von docs/architecture/DATENSCHUTZ.md. Volltext dort pflegen und
// bei inhaltlichen Änderungen hier nachziehen (#96).
const SECTIONS: Section[] = [
  {
    title: 'Wie deine Daten geschützt werden',
    body:
      'Es gibt keine Ende-zu-Ende-Verschlüsselung — der Server muss Daten lesen ' +
      'können, um sie nach Haushalt zu filtern und in Echtzeit zu synchronisieren. ' +
      'Stattdessen: Transportverschlüsselung (TLS), Verschlüsselung at rest auf ' +
      'Datenbankebene, und Zugriffstrennung über Row Level Security — persönliche ' +
      'Gesundheitsdaten (Tagebuch, Gewicht, Ziele, Profil) sind selbst für ' +
      'Haushalts-Administratoren nicht einsehbar. Zugriffstokens liegen ' +
      'ausschließlich im geräteeigenen Keychain/Keystore.',
  },
  {
    title: 'Welche Daten verarbeitet werden',
    body:
      'Konto (E-Mail), Profil (Anzeigename, Geburtsdatum, Größe, Aktivitätslevel), ' +
      'Gesundheits-/Ernährungsdaten (Tagebuch, Gewicht, Ziele — privat, nicht mit ' +
      'dem Haushalt geteilt), Kinderprofile, Haushaltsdaten (Name, Mitglieder, ' +
      'Rollen — geteilt mit dem Haushalt), Kühlschrank- und Einkaufslisten-Daten ' +
      '(geteilt mit dem Haushalt), Produktdaten (Barcode, Nährwerte).',
  },
  {
    title: 'Drittdienste',
    body:
      'Open Food Facts: Beim Barcode-Scan oder der Produktsuche wird der ' +
      'Barcode/Suchbegriff an die öffentliche Open-Food-Facts-API gesendet — ' +
      'ohne Konto- oder Gesundheitsdaten. Supabase hostet Datenbank, ' +
      'Authentifizierung und Realtime-Synchronisation. Google AdMob liefert ' +
      'Werbung für die kostenlose Version. RevenueCat verarbeitet ' +
      'Kauf- und Abo-Status. Sentry, PostHog und Aptabase helfen bei ' +
      'Fehlerdiagnose, Produktverbesserung und Nutzungsanalyse.',
  },
  {
    title: 'Berechtigungen',
    body:
      'Kamera: Barcode-Scan und QR-Code-Beitritt (optional, manuelle Eingabe ' +
      'geht immer). Benachrichtigungen: lokale Erinnerung vor Ablauf eines ' +
      'Kühlschrank-Artikels (optional). Standort und Fotomediathek werden nur ' +
      'für die jeweiligen Funktionen angefragt. Das Mikrofon wird nur im ' +
      'Kamera-Kontext technisch bereitgestellt und nicht für Werbung verwendet.',
  },
  {
    title: 'Werbung und Tracking',
    body:
      'Die kostenlose Version verwendet Google AdMob. Auf iOS fragen wir vor ' +
      'personalisierten Anzeigen nach der App-Tracking-Erlaubnis. Wenn du sie ' +
      'ablehnst, kann die App weiterhin nicht personalisierte oder ' +
      'eingeschränkte Werbung anzeigen. Deine Auswahl kannst du über die ' +
      'Werbe-Einstellungen ändern.',
  },
  {
    title: 'Deine Rechte',
    body:
      'Auskunft/Export über Einstellungen → Export als JSON. Löschung über ' +
      'Einstellungen → Konto löschen — geteilte Haushaltsdaten bleiben für ' +
      'verbleibende Mitglieder bestehen, nur deine privaten Daten werden ' +
      'entfernt. Profil- und Tagebuchdaten sind direkt in der App editierbar.',
  },
];

export function PrivacyScreen() {
  const [privacyOptionsLoading, setPrivacyOptionsLoading] = useState(false);

  async function handleAdsPrivacyOptions() {
    if (privacyOptionsLoading) return;
    setPrivacyOptionsLoading(true);

    try {
      const opened = await showAdsPrivacyOptions();
      if (!opened) {
        Alert.alert(
          'Keine Werbe-Einstellungen verfügbar',
          'Google stellt für dieses Gerät derzeit kein zusätzliches Privacy-Options-Formular bereit.',
        );
      }
    } catch {
      Alert.alert(
        'Werbe-Einstellungen nicht verfügbar',
        'Die Werbe-Einstellungen konnten gerade nicht geladen werden.',
      );
    } finally {
      setPrivacyOptionsLoading(false);
    }
  }

  return (
    <Screen
      title="Datenschutz"
      back={{ label: 'Einstellungen', href: '/settings' }}
      backStyle="icon">
      <View className="gap-three">
        {SECTIONS.map((section) => (
          <Card key={section.title}>
            {/* Die Card-Komponente setzt den Abstand zwischen Titel und Text. */}
            <Txt variant="body" weight="700">
              {section.title}
            </Txt>
            <Txt variant="body" tone="secondary">
              {section.body}
            </Txt>
          </Card>
        ))}
        <Card>
          <Txt variant="body" weight="700">
            Werbe-Einstellungen
          </Txt>
          <Txt variant="body" tone="secondary">
            Verwalte die Einwilligung für personalisierte Werbung und die damit verbundenen
            Anbieter.
          </Txt>
          <Button
            label="Werbe-Einstellungen öffnen"
            variant="secondary"
            size="compact"
            loading={privacyOptionsLoading}
            onPress={handleAdsPrivacyOptions}
          />
        </Card>
      </View>
    </Screen>
  );
}
