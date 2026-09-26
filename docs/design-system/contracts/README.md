# Design-System-Verträge

Diese Verträge beschreiben die gemeinsamen UI-Regeln. Produktionscode definiert die
verfügbaren APIs und konkreten Werte; die Dokumentation hält deren fachliche
Verwendung fest.

## Zuständigkeiten

| Owner | Verantwortung |
| --- | --- |
| [src/components/theme/index.ts](../../../src/components/theme/index.ts) | Paletten und Design-Tokens |
| [src/components/theme/ThemeProvider.tsx](../../../src/components/theme/ThemeProvider.tsx) | Präferenz und Auswahl der aktiven Palette |
| [src/constants/ui.tsx](../../../src/constants/ui.tsx) und [src/constants/ui-shadow.ts](../../../src/constants/ui-shadow.ts) | Gemeinsame UI-Primitiven, semantische Styles und fertige Schatten-Styles |

Das sind die drei Owner für Theme, ThemeProvider und UI. ui-shadow.ts ist das
Schattenmodul des UI-Owners. Feature-Code besitzt Verhalten, Komposition,
Accessibility-Metadaten und lokales Layout; er erzeugt keine zweite Palette
oder gemeinsame Gestaltungsrezepte.

react-native-unistyles v3 ist die Styling-Runtime. Theme- und Runtime-abhängige
Styles verwenden typisierte Callbacks. Die Regeln stehen in
[Vertrag 05](./05-unistyles-and-stylesheet.md).

## Gültigkeit

- Ein Vertrag beschreibt Anforderungen, aber nicht den aktuellen Umsetzungsstand
  jedes Consumers.
- Ein Beispiel zeigt eine zulässige Verwendung; die verfügbare API steht im Code.
- Native Screenshots belegen nur die geprüfte Plattform und Konfiguration.
- Ausnahmen für native Controls und externe Produktkennzeichnungen bleiben auf
  ihren jeweiligen Einsatz begrenzt.

## Verträge

1. [Theme und Farben](./01-theme-and-colors.md)
2. [Typografie](./02-typography.md)
3. [Abstände und Layout](./03-spacing-and-layout.md)
4. [Radien und Schatten](./04-radius-shadow.md)
5. [Unistyles und StyleSheet](./05-unistyles-and-stylesheet.md)
6. [Surfaces und Cards](./06-surfaces-and-cards.md)
7. [Buttons und Interaktion](./07-buttons-and-interaction.md)
8. [Felder und Auswahl](./08-fields-and-selection.md)
9. [Screens und Navigation](./09-screens-and-navigation.md)
10. [Accessibility und Zustände](./10-accessibility-and-states.md)
11. [Modal und Sheets](./11-modal-and-sheets.md)
12. [Native iOS-DatePicker](./12-date-picker.md)

Die Referenz unter Einstellungen zeigt vorhandene UI-Komponenten und Zustände.
Sie ersetzt keine gezielte Prüfung der betroffenen Produkt- oder Gerätefläche.
