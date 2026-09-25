# Design-System-Verträge

Stand: 2026-09-05. Diese Dateien sind die normative Referenz für das fam-Design-System.
Sie beschreiben den verbindlichen Zielzustand. Die Überarbeitung der Dokumente
ist kein Nachweis, dass App-Code und Referenzseite bereits vollständig entsprechen.

## Gültigkeit und Umsetzung

- **Vertrag:** legt Zuständigkeiten, Verhalten und überprüfbare Anforderungen fest.
- **Migrationsbestand:** vorhandener Code, der noch abweicht. Er darf während der
  Migration weiterarbeiten, ist aber keine Vorlage für neue Implementierungen.
- **Integrationsausnahme:** konkret begründete Grenze, etwa eine native Kamera
  oder offizielle Produktkennzeichnung. Sie wird im zuständigen Vertrag mit
  Pfad, Plattform, Grund und Prüffall benannt; Altbestand allein ist kein Grund.
- **Beispiel:** zeigt die beabsichtigte Verwendung einer API. Es ist keine Aussage
  über den Implementierungsstatus aller Komponenten.
- **Nachweis:** gezielter Test, Codeprüfung oder dokumentierte Geräteprüfung.
  Ein Screenshot von Web belegt kein natives Verhalten.

Die abgeschlossene UI-Konsolidierung ist in den Beads-Aufgaben `fam-978` und
`fam-7xer` nachverfolgbar. Die Contracts besitzen die laufenden Regeln; ein
separater Konsolidierungsplan ist keine parallele Designquelle.

Die Dokumentationsüberarbeitung autorisiert keine App-Codeänderung. Bei späterer
Umsetzung müssen Code, Contracts und Referenzseite denselben Zustand erreichen.
Planung und Arbeitsstatus werden separat geführt, Arbeitspakete in Beads.

## Genau drei Verantwortliche

| Quelle | Verantwortung |
| --- | --- |
| `src/components/theme/index.ts` | Wiederverwendbare Tokens: Paletten, Schriftmaße und Gewichte, Abstände, Radien, Schattenfarben, Verläufe und gemeinsame Maße |
| `src/components/theme/ThemeProvider.tsx` | Persistierte Theme-Präferenz, Auflösung von `system/light/dark`, aktive Palette, `useTheme()` und `useThemedStyles()` |
| `src/constants/ui.tsx` und `src/constants/ui-shadow.ts` | Ein gemeinsamer UI-Owner: Primitive und semantische Styles für Typografie, Farbpaare, Flächen, Konturen, Schatten, Interaktionszustände, Motion und Haptikzuordnung; `ui-shadow.ts` enthält ausschließlich die exportierten Schatten-Styles |

Die drei Owner bleiben Theme, ThemeProvider und UI. `ui-shadow.ts` ist ein
Schattenmodul innerhalb des dritten Owners, keine vierte globale Verantwortung.
Höhere Komponenten besitzen Verhalten, Komposition, Accessibility-Metadaten und
lokales Layout. Sie wenden die zentralen Styles an. `className` ist verboten.
Theme- oder Runtime-abhängige Styles entstehen über typisierte
Unistyles-Callbacks; vollständig statische, lokale Styles dürfen die statische
`StyleSheet.create`-Form verwenden. Die verbindlichen Regeln stehen in
[Vertrag 05](./05-unistyles-and-stylesheet.md).
Das repo-weite Styling-Gate
`test/conventions/nativewind-removal.test.ts` schützt diesen Endzustand. Es
prüft JavaScript/TypeScript unter `src/` und im Root per Syntaxbaum auf verbotene
Props (auch in Objekt-Spreads) und Referenzen auf ausgemusterte Styling-Pakete
oder Interop-APIs. Root-Konfiguration, direkte Pakete in `package.json` und im
Bun-Root-Workspace, ausgemusterte Styling-Assets und aktive CSS-Direktiven sind
ebenfalls abgesichert. Kommentare, historische Docs und eigenständige Tools
bleiben ausgenommen; Abhängigkeiten separater Tool-Oberflächen außerhalb des
App-Workspaces gelten nicht als App-Styling-Abhängigkeit. Gegenbeispiele prüfen
die Erkennung in temporären Dateibäumen.

Der gemeinsame allgemeine `Button`, `TextField`, `SegmentedControl`, `Txt` und
`Surface` werden direkt aus `src/constants/ui.tsx` importiert.
Spezifische Produktkompositionen wie Back-, Header- oder Floating-Action-Buttons
dürfen unter `src/components/ui/buttons/` bleiben, besitzen aber keine zweite
allgemeine Button-Darstellung.

Reine Prop-Adapter werden nach der Consumer-Migration entfernt. Adapter bleiben
nur bei eigenständiger Komposition oder nativer Integration zulässig und
verwenden weiterhin das zentrale Rezept. Zwei unabhängige Darstellungen für
denselben Komponentenvertrag sind kein zulässiger Endzustand.

## Vertragsübersicht

1. [Theme und Farben](./01-theme-and-colors.md)
2. [Typografie](./02-typography.md)
3. [Spacing und Layout](./03-spacing-and-layout.md)
4. [Radien, Schatten und Verläufe](./04-radius-shadow-gradient.md)
5. [Unistyles und StyleSheet](./05-unistyles-and-stylesheet.md)
6. [Surfaces und Cards](./06-surfaces-and-cards.md)
7. [Buttons und Interaktion](./07-buttons-and-interaction.md)
8. [Felder und Auswahl](./08-fields-and-selection.md)
9. [Screens und Navigation](./09-screens-and-navigation.md)
10. [Accessibility und Zustände](./10-accessibility-and-states.md)
11. [Modal und Sheets](./11-modal-and-sheets.md)
12. [Native iOS-DatePicker](./12-date-picker.md)

## Referenzseite und Abnahme

`/settings/design-system` zeigt die vorgesehenen Produktkomponenten und die
zugehörigen Grundlagen. Legacy-Adapter sind ausdrücklich als solche beschriftet.
Gegenbeispiele sind eindeutig gekennzeichnet und dürfen nicht in Produktcode
übernommen werden.

Die Referenz umfasst Light/Dark, lange Beschriftungen und die unterstützten
Normal-, Fokus-, Auswahl-, Fehler-, Disabled- und Loading-Zustände. Große Schrift
und schmale Breite werden mit tatsächlichen Geräte-/Viewport-Einstellungen
geprüft. Die einzelnen Verträge benennen ihre Nachweise; die übergreifende
Prüfmatrix steht in [Vertrag 10](./10-accessibility-and-states.md).

Neue Beispiele dürfen keine noch nicht implementierte API als bereits vorhanden
präsentieren. Fehlende Plattformnachweise werden offen benannt. Nichttriviale
Layout-/Copy-Änderungen benötigen gemäß `AGENTS.md` mehrere statische Mocks und
eine Auswahl vor der Implementierung. Funktionsumfang und Gegenaktionen bleiben
erhalten; dieser Vertrag ist keine Freigabe für ein Redesign aller Screens.
