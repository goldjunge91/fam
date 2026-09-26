# Vertrag: Radien und Schatten

Radien, Konturstärken und Buttontiefe stehen in
[src/components/theme/index.ts](../../../src/components/theme/index.ts).
Gemeinsame Styles liegen in [ui.tsx](../../../src/constants/ui.tsx);
fertige Schatten exportiert [ui-shadow.ts](../../../src/constants/ui-shadow.ts).

## Regeln

- Wiederkehrende Radien und Konturen verwenden die zentralen Werte.
  Feature-Code führt keine zweite Skala ein.
- Natürliche, nicht kapselartige Ecken behalten die gemeinsame kontinuierliche
  Kurvenbehandlung. Pill- und Kreisformen folgen ihrer eigenen Geometrie.
- Ein benötigter Schatten wird als fertiger uiShadowStyles-Style über die
  vorhandene style-API angewendet. Feature-Code kopiert keine Geometrie und
  erfindet keine shadow- oder elevation-Prop.
- Schattenfarben dienen ausschließlich Schatten.
- Wiederverwendbare Card-Rezepte kombinieren Fläche, Kontur, Radius und Schatten
  nicht lokal neu.
- Schatten und Konturen werden weder pauschal entfernt noch dekorativ auf jedes
  Element gesetzt.

Sichtbare Buttontiefe, Flat-Ausnahmen und Reduced Motion folgen dem
[Interaktionsvertrag](./07-buttons-and-interaction.md). Die iOS- und
Android-Darstellung wird auf den jeweiligen Plattformen geprüft.
