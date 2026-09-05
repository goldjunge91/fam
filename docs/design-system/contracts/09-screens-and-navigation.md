# Vertrag: Screens und Navigation

## Zweck und Zuständigkeit

`Screen` ist das gemeinsame Gerüst für Safe Area, Hintergrund, Inhaltsbreite,
Scrollen, Tastatur, unteren Freiraum und Header. Es verwendet Tokens aus
`index.ts`, das aktive Theme aus dem Provider und gemeinsame Darstellung aus
`ui.tsx`. `HubScreen` und weitere vorhandene Kompositionen wenden dieselben Regeln
an, ohne eine zweite Header-/Flächenpalette zu besitzen.

Domänen wählen Datenzustände und Aktionen. Gemeinsame Layout- und Zustandsdarstellung
wird nicht für jeden Screen neu gebaut. Native Spezialflächen wie Kamera oder
Medienviewer dürfen einen begründeten eigenen Container verwenden.

## Header und Navigation

| Modus | Zweck |
| --- | --- |
| `chrome` | Hauptbereich mit Menü, Titel, Aktionen und Profil |
| `back` | Unterseite mit Historie und gegebenenfalls Fallback-Ziel |
| normaler Titel | einfacher Screen ohne Hauptbereichschrome |
| `ScreenHeader` | bewusst manuell komponierter Header auf denselben Regeln |

`chrome` und `back` werden nicht gleichzeitig verwendet. Bestehende Navigationswege,
Hauptaktionen und Rückwege bleiben erhalten. Diese Contracts autorisieren keinen
Umbau der Informationsarchitektur.

Lange Titel und große Schrift dürfen Header wachsen oder kontrolliert umbrechen
lassen. Aktionen dürfen nicht verschwinden, sich überlagern oder den Titel unlesbar
zusammendrücken. Titel verwenden die zentrale Typografie. Zusätzliche dekorative
Untertitelzeilen werden nicht eingeführt. Änderungen an bestehender Header-Copy
oder konkreter Anordnung benötigen die vorgesehene Mockauswahl.

## Scrollen, Safe Area und Tastatur

- Pro Inhaltsbereich gibt es einen verantwortlichen Scrollcontainer. Nutzt ein
  Screen eine FlashList oder einen eigenen ScrollView, übernimmt das äußere
  Gerüst nicht zusätzlich das Scrollen desselben Inhalts.
- FlashList wird nicht in einen ScrollView verschachtelt. Nicht scrollende kleine
  Inhaltsgruppen werden direkt gerendert.
- Safe-Area-Werte werden genau einmal berücksichtigt, auch bei sichtbarem
  Sync-Banner. Feste gemeinsame Aktionsmaße stammen aus zentralen Tokens;
  tatsächliche native Insets bleiben Laufzeitwerte.
- Die letzte Zeile samt Aktionen muss vollständig über globale Aktionsflächen
  scrollen können. Zusätzliche lokale Bottom-Paddings dürfen nicht versehentlich
  denselben Freiraum mehrfach reservieren.
- Tastatur und Sheets verdecken keine notwendige Eingabe oder Bestätigungsaktion.
  Keyboard-/Toolbar-Verantwortung folgt [Vertrag 08](./08-fields-and-selection.md).
- Rotation und Web-Resize aktualisieren die Anordnung ohne Neustart. Die bestehende
  maximale Inhaltsbreite 600 bleibt Ausgangspunkt.

## Dichte, Inhalte und erreichbare Aktionen

Bei 320 logischen Einheiten Breite und Schriftfaktor 2,0 bleiben notwendige
Informationen und primäre Aktionen zugänglich. Kein pauschales Verkleinern der
Schrift und kein horizontaler Screen-Overflow. Explizit horizontale Filter oder
fachliche Grids sind zulässig, wenn sie zugänglich bedienbar bleiben.

Einkaufszeilen erhalten identifizierbare Namen, nicht überlagernde Mengen/Preise
und vergleichbar ausgerichtete Zahlen. Gezielte Kürzung ist nur mit erreichbar
vollständiger Information zulässig. Die konkrete ein-/zweizeilige Gestaltung ist
eine Mockentscheidung; Mengenformatierung und Preislogik bleiben unverändert.

Long-Press-/Swipe-Funktionen bleiben erhalten. Wenn die Geste allein nicht
zugänglich bedienbar ist, gibt es eine erreichbare alternative Aktion.
Status-/Lade-/Fehlerdarstellung richtet sich nach
[Vertrag 10](./10-accessibility-and-states.md). Ein fehlender Haushalt ist kein
leerer Datenbestand; Offline mit lokal vorhandenen Daten bleibt nutzbar.

## Beispiel der vorgesehenen Verwendung

```tsx
import { Screen } from '@/components/layout/screen';

<Screen
  title="Produktsuche"
  back={{ label: 'Einstellungen', href: '/settings' }}
  backStyle="icon">
  {content}
</Screen>
```

Ein gewöhnlicher Feature-Screen mit eigener Safe-Area-/Header-/Typografiedefinition
umgeht das Gerüst. Ein native bedingter eigener Container benötigt eine konkrete
Integrationsbegründung statt einer pauschalen Ausnahme für das gesamte Feature.

## Nachweis

Gezielte Screen-Tests prüfen Header-/Scroll-/Inset-Verhalten. Native Prüfung mit
Tastatur, Sheet, Sync-Banner, langer Liste, langem Titel und großer Schrift belegt
die tatsächliche Erreichbarkeit. Web-Resize und native Rotation werden gesondert
geprüft. Bestehende Funktionen und Gegenaktionen bleiben Teil der betroffenen
Flow-Prüfung. Die Navigation wird dafür nicht neu spezifiziert.
