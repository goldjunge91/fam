# Vertrag: Unistyles und StyleSheet

react-native-unistyles v3 ist die einzige aktive Styling-Runtime. Themewerte und
gemeinsame UI-Rezepte stehen in der [Übersicht](./README.md).

## Regeln

- StyleSheet wird aus react-native-unistyles importiert.
- Theme- oder Runtime-abhängige Styles verwenden typisierte
  StyleSheet.create-Callbacks. Vollständig statische lokale Styles dürfen statisch
  angelegt werden.
- Reaktive Unistyles-Styles werden nicht per Object Spread kombiniert; dafür
  werden Style-Arrays verwendet. StyleSheet.absoluteFill darf im Array stehen.
- Das Babel-Plugin verarbeitet den App-Quellcode. StyleSheet.configure läuft
  vor dem ersten StyleSheet.create.
- className und contentContainerClassName sind nicht zulässig.

## Domain-Paletten

Domain-Paletten gehören ihrem Fach-Owner und werden nicht in index.ts oder
ui.tsx kopiert:

- store-presets.ts besitzt Markt-Presets und nutzergewählte Store-Farben.
- placement-taxonomy.ts besitzt die Platzierungs- und Einkaufslistenklassifikation.
- Produktfarben aus externen Kennzeichnungen bleiben auf die jeweilige
  Produktanzeige begrenzt.

### ProductInformation und Nutri-Score

Die fünf offiziellen Nutri-Score-Farben aus Open Food Facts bleiben in
NUTRI_BADGE_COLORS unter
src/features/inventory/components/product-information.tsx. Sie dienen nur der
Nutri-Score-Badge-Fläche. Es gibt keinen zweiten Farb-Map-Owner und keine Kopie
dieser Werte in den drei globalen Theme-Ownern.

### Native Integrationsgrenzen

- Das QR-Code-Modul im Haushaltseinladungsdialog behält seine opake weiße
  Quiet-Zone, damit es auf hellen und dunklen Flächen scanbar bleibt.
- iOS-Kategorie- und Einkaufsabschluss-Sheets verwenden ihre native
  SwiftUI-Präsentation. Android-Adapter bleiben getrennt. Neue iOS-Adapter
  importieren keine Community-Sheets.
- Native Views, Medien und offizielle Produktkennzeichnungen dürfen ihrer
  System- oder Quellenfarbe folgen. Die Ausnahme bleibt auf den tatsächlichen
  Integrationsfall beschränkt.

Die native Grenze wird mit dem passenden Plattformfall geprüft. Ein Web-Screenshot
belegt kein natives Verhalten.
