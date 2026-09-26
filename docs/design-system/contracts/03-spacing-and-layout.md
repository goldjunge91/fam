# Vertrag: Abstände und Layout

Wiederverwendbare Abstände und Maße stehen in
[src/components/theme/index.ts](../../../src/components/theme/index.ts). Die
konkrete Skala wird hier nicht dupliziert.

## Regeln

- Wiederkehrende Abstände und Maße verwenden bestehende Tokens. Eine neue
  gemeinsame Größe gehört in den Theme-Owner.
- Einmalige Geometrie darf lokal bleiben. Gleiche Zahlen allein begründen kein
  gemeinsames Token; die Layoutrolle muss übereinstimmen.
- Wiederholte Rechnungen werden nur dann zentral benannt, wenn dieselbe
  Layoutentscheidung mehrfach vorkommt.
- Flexible Anordnung und Umbruch haben Vorrang vor starren Höhen oder
  proportionalem Wachstum der gesamten Oberfläche.
- Laufzeitabhängige Geometrie bleibt lokal bei der betroffenen Komponente.
  Importierte Themewerte werden nicht als reaktive Fenstermaße behandelt.
- Safe-Area-Werte werden genau einmal berücksichtigt. Eigenständige
  Interaktionen behalten mindestens 44 × 44 logische Einheiten wirksame
  Touchfläche; siehe [Vertrag 07](./07-buttons-and-interaction.md).
- Listenzeilen werden über die vorgesehene Zeilentrennung angeordnet, nicht
  durch zusätzliches Container-Padding.

## Inhaltsbreite und Scrollen

Die lesbare Inhaltsspalte bleibt auf kleinen Geräten flexibel und wird auf
größeren Flächen begrenzt und zentriert. Ein allgemeines Tablet-Redesign folgt
daraus nicht. Jede Fläche hat einen verantwortlichen Scrollcontainer;
FlashList wird nicht in einen ScrollView eingeschachtelt.

Feature-Styles folgen den [Unistyles-Regeln](./05-unistyles-and-stylesheet.md).
Schmale Breite, große Schrift, Safe Area, Tastatur und Scrollverantwortung
werden am betroffenen Screen geprüft.
