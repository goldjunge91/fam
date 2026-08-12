import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

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
    <Screen title="Datenschutz" back={{ label: 'Einstellungen', href: '/settings' }}>
      <View style={styles.sections}>
        {SECTIONS.map((section) => (
          <Card key={section.title}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              {section.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {section.body}
            </ThemedText>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: {
    gap: Spacing.three,
  },
  sectionTitle: {
    marginBottom: Spacing.one,
  },
});
