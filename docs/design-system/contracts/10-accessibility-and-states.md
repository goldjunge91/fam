# Vertrag: Accessibility und Zustände

## Zuständigkeit

Gemeinsame selected-, focused-, pressed-, disabled- und loading-Rezepte liegen
in [ui.tsx](../../../src/constants/ui.tsx). Komponenten verantworten Verhalten
und Accessibility-Metadaten; die Domäne entscheidet über Datenzustände.

## Interaktion

- Aktionen haben verständlichen Namen und passende Rolle. Dekorative Icons
  erzeugen keinen unnötigen Fokus.
- selected, checked, disabled, busy und expanded werden gemäß der tatsächlichen
  Semantik gemeldet.
- Eigenständige Aktionen haben mindestens 44 × 44 logische Einheiten wirksamen
  Touchbereich ohne abgeschnittene oder überlappende Ziele.
- Loading und Disabled blockieren Aktivierung und Haptik. Retry wiederholt eine
  fehlgeschlagene Abfrage, nicht automatisch eine bereits ausgelöste Mutation.
- Status wird zusätzlich über Text, Symbol oder Form vermittelt.
  Screenreader-Metadaten ersetzen keine sichtbare Zustandsdarstellung.
- Fokusfolge bleibt sinnvoll; Fehler sind dem Feld zugänglich zugeordnet. Web
  unterstützt Tastaturaktivierung und sichtbaren Fokus. Sheets übernehmen den
  Fokus sinnvoll und geben ihn nach dem Schließen zurück.
- Reduced Motion entfernt kein notwendiges Zustandsfeedback. Details zu
  Bewegungs- und Pressed-Verhalten stehen in
  [Vertrag 07](./07-buttons-and-interaction.md).

Die komponentenspezifischen Touch- und Namensregeln stehen in Vertrag 07.
Bedienregeln für SectionHeading stehen in
[Vertrag 09](./09-screens-and-navigation.md).

Kontrast folgt [Vertrag 01](./01-theme-and-colors.md).

## Datenzustände

| Situation | Darstellung | Bestehender Handlungsweg |
| --- | --- | --- |
| Erstladen ohne Daten | Zugänglich benannter Ladezustand, bei Vorrat/Einkauf passende Platzhalter | Navigation bleibt möglich |
| Aktualisieren mit Daten | Inhalte bleiben sichtbar, dezentes Feedback | zulässige lokale Aktionen |
| Erfolgreich leer | Fachlicher Leerzustand | passende bestehende Hinzufügen-/Erstellen-/Beitreten-Aktion |
| Suche oder Filter ohne Treffer | eigener Kein-Treffer-Zustand | Suche/Filter zurücksetzen |
| Lesefehler ohne Daten | verständlicher Fehler, keine Leermeldung | gezielter Retry |
| Aktualisierungsfehler | Daten bleiben sichtbar, Fehlerhinweis erreichbar | erneut lesen |
| Offline mit lokalen Daten | lokale Inhalte und erlaubte Aktionen | Outbox und globaler Sync-Banner |
| Fehlender Haushalt/Berechtigung | bestehender Zugriffsstatus | zulässiger Beitritts-/Erstellungsweg |

Loading, Error und Empty sind getrennt. Offline ist bei lokal vorhandenen Daten
kein Lesefehler. Ein Feature erzeugt keinen zweiten globalen Offline-Banner.
Retry legt keine Daten an; bestehende lokale Mutationen bleiben im Outbox-Flow.
Technische Rohfehler und sensible Details gehören nicht in UI-Copy.

Die Domäne wählt den Zustand; ein universeller Async-Screen-Wrapper ist nicht
erforderlich. EmptyState bündelt Symbol, Titel, Hinweis und eine optionale
bestehende Aktion. Native Spezialladezustände müssen nicht durch Listenskeletons
ersetzt werden.

## Prüfungen und Aussagekraft

| Dimension | Mindestprüfung |
| --- | --- |
| Plattform | iOS und Android auf dem Dev Client, sofern verfügbar; Web separat |
| Theme | Light und Dark, Systempräferenz sowie explizite App-Präferenz gegen das Systemtheme; Wechsel im geöffneten Formular |
| Breite | 320 und 393 logische Einheiten sowie ab 768; Rotation und Web-Resize |
| Schrift | Faktor 1,0 und 2,0; größte angebotene Accessibility-Schrift als Grenzfall |
| Assistenz | VoiceOver, TalkBack und Web-Tastatur; Name, Rolle, Zustand, Fokus und Aktivierung |
| Bewegung | Tatsächliche Reduced-Motion-Präferenz ein und aus |
| Eingabe | Fehler und Fokus, Disabled, trailing action, Tastatur und Sheet |
| Daten | Alle für den Consumer zutreffenden Zustände aus der Datenzustandsmatrix |

Gezielte Tests belegen Namen, Rollen, States, Callbacks, Blockierung, Fehler und
Produktszenarien. Kleine Styleprüfungen belegen weder echte Touchflächen noch
Umbruch. Vorrat, Einkauf und ein Auth-/Bearbeitungsformular erhalten passende
Prüfungen; weitere geänderte Verbraucher werden gezielt geprüft. Eine vollständige
Kreuzkombination aller Screens ist nicht erforderlich.

Native Trefferflächen, Systemschrift, Assistenz und Motion erfordern die jeweilige
Plattform. Ein Web-Screenshot belegt das nicht. Nicht verfügbare Geräte oder
Testdaten werden als fehlender Nachweis benannt. Die Design-System-Referenz zeigt
echte Produktkomponenten, ist aber kein Beleg für jeden Consumer.
