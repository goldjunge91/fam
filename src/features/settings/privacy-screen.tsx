import { View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Card } from '@/components/ui/card';

type Section = {
  title: string;
  body: string;
};

// Gekürzte In-App-Fassung von docs/DATENSCHUTZ.md. Volltext dort pflegen und
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
      'Authentifizierung und Realtime-Synchronisation. Keine Werbe-SDKs, kein ' +
      'Tracking durch Dritte, kein Verkauf von Daten.',
  },
  {
    title: 'Berechtigungen',
    body:
      'Kamera: Barcode-Scan und QR-Code-Beitritt (optional, manuelle Eingabe ' +
      'geht immer). Benachrichtigungen: lokale Erinnerung vor Ablauf eines ' +
      'Kühlschrank-Artikels (optional). Standort, Mikrofon, Kontakte und ' +
      'Fotomediathek werden nicht angefragt.',
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
  return (
    <Screen
      title="Datenschutz"
      back={{ label: 'Einstellungen', href: '/settings' }}
      backStyle="icon">
      {/* Übersicht aller Datenschutz-Abschnitte (Verschlüsselung, Datenarten, Drittdienste, Rechte) */}
      <View className="gap-three">
        {SECTIONS.map((section) => (
          <Card key={section.title}>
            {/* Kein separates marginBottom mehr: card-fam liefert bereits
                gap-two zwischen Titel und Text (Card-Komponente). */}
            <ThemedText type="smallBold">{section.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {section.body}
            </ThemedText>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
