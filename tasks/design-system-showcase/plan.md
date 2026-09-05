# Implementierungsplan: Design-System-Referenz

## Ziel

Das bestehende Fam-Design-System wird als echte, interne App-Referenz sichtbar.
Konzept B ist verbindlich: ein navigierbarer Referenz-Screen mit Kategorien,
echten Produktkomponenten und direkt daneben klar markierten Vertragsbrüchen.

Die Referenz erweitert das vorhandene System. Sie ersetzt weder NativeWind noch
die zentrale Theme- oder UI-API.

## Feste Grenzen

- NativeWind bleibt installiert und für statisches Layout zuständig.
- Themeabhängige Werte und native Spezialfälle verwenden die vorhandenen Tokens
  und typisierte React-Native-Styles.
- `ThemeProvider.tsx` bleibt unverändert. `index.ts` und `ui.tsx` dürfen nur für
  ausdrücklich freigegebene Token-, Button-, Field- und Typografieänderungen
  angepasst werden.
- Gegenbeispiele bleiben lokale, nicht exportierte Demo-Darstellungen.
- Es werden keine vorhandenen Dateien gelöscht, verschoben oder vollständig
  ersetzt.
- Kein nativer Build und keine vollständige Testsuite.

## Struktur

```text
docs/design-system/
  DESIGN_SYSTEM.md
  contracts/
    01-theme-and-colors.md
    02-typography.md
    03-spacing-and-layout.md
    04-radius-shadow-gradient.md
    05-nativewind-and-stylesheet.md
    06-surfaces-and-cards.md
    07-buttons-and-interaction.md
    08-fields-and-selection.md
    09-screens-and-navigation.md
    10-accessibility-and-states.md

src/features/settings/dev/design-system/
  design-system-screen.tsx
  design-system-screen.android.tsx
  showcase-foundations.tsx
  showcase-foundations.android.tsx
  showcase-components.tsx
  showcase-components.android.tsx
  showcase-patterns.tsx
  showcase-patterns.android.tsx
  showcase-shared.tsx
  showcase-shared.android.tsx
```

## Umsetzungsslices

1. Referenzroute, Kategorienavigation und gemeinsame Showcase-Bausteine.
2. Theme, Farben, Akzente, Typografie, Abstände, Radien, Schatten, Verläufe und
   Plattformfonts mit ihren realen Tokenwerten darstellen.
3. Oberflächen, Karten, Buttons, Haptics, Felder, Auswahl, Status und Feedback
   mit echten Komponenten darstellen.
4. Screen-, Navigations-, NativeWind-/StyleSheet- und Accessibility-Verträge
   als umgesetztes und nicht umgesetztes Beispiel darstellen.
5. Jeden Vertrag in einer eigenen Datei unter `docs/design-system/contracts/`
   dokumentieren und mit der echten Referenzroute verknüpfen.
6. Den Screen in den vorhandenen Entwicklerbereich einhängen.
7. Buttontiefe und Field-Fokus nach visueller Maintainer-Abnahme festschreiben.
8. Die Typografie-API über dokumentierte, einzeln überprüfbare Batches reduzieren.

## Definition of Done

- Jede öffentliche Tokenkategorie aus `src/components/theme/index.ts` ist
  sichtbar abgebildet.
- Jede relevante Komponentenfamilie hat ein echtes, interaktives Beispiel.
- Jeder Vertrag zeigt ein korrektes und ein klar abgegrenztes falsches Beispiel.
- Light und Dark werden über den echten ThemeProvider gezeigt, nicht simuliert.
- Die Dokumentation ist eine aktuelle Referenz und keine Änderungshistorie.
- Biome und eine fokussierte TypeScript-Prüfung der neuen Dateien sind sauber.
