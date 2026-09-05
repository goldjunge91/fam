# Capability Map: Fam NativeWind Styling Stabilisierung

## Status

Abgeschlossen und historisch. Diese Map beschreibt die damalige Migration.
Verbindlich für neuen und überarbeiteten Code sind die Verträge unter
`docs/design-system/contracts/` und die UI-Regeln in `AGENTS.md`.

## Zweck

Diese Initiative stabilisierte die bestehende UI-Styling-Architektur von fam.
NativeWind blieb installiert, wurde aber auf einfaches statisches Layout
begrenzt. Die vorhandene Fam-Mauve-/Creme-Palette blieb die visuelle Wahrheit.
Die damaligen Referenzdateien wurden in die heutigen drei zentralen Quellen
`index.ts`, `ThemeProvider.tsx` und `src/constants/ui.tsx` überführt.

## Module

| Module id | Verantwortung | Abhängigkeiten |
| --- | --- | --- |
| `token-integrity` | Eine typisierte, semantische Fam-Tokenquelle für Farben, Abstände, Radien, Typografie, Elevation und Zustände | historische Werte, heute konsolidiert in `src/components/theme/index.ts` |
| `theme-runtime` | Ein einziger `ThemeProvider`, System-/Light-/Dark-Auflösung und dynamische StyleSheet-Erzeugung | `token-integrity`, bestehender Gerätespeicher |
| `typography-contract` | Ersatz für `ThemedText`, vollständige Textrollen, definierte Priorität zwischen Token, NativeWind und Inline-Style | `token-integrity`, `theme-runtime` |
| `core-ui-contract` | Ersatz für `ThemedView` und Stabilisierung von Button, Card, Field, Press, Badge und verwandten Primitiven | `token-integrity`, `theme-runtime`, `typography-contract`, `src/lib/haptics.ts` |
| `native-boundaries` | Regeln für NativeWind-kompatible und inkompatible Komponenten sowie StyleSheet-Hybridnutzung | `token-integrity`, `theme-runtime`, `core-ui-contract` |
| `verification-matrix` | Tests, statische Audits und zwei Screen-Mocks gegen Regressionen | alle vorherigen Module |

## Build-Reihenfolge

`token-integrity` -> `theme-runtime` -> `typography-contract` -> `core-ui-contract` -> `native-boundaries` -> `verification-matrix`

## Nicht Bestandteil der Initiative

- Wechsel zu Uniwind, Unistyles, Tamagui oder einem anderen Styling-Framework.
- Übernahme der ui-Farben wie Basil, Carrot, Grape oder Pantry Pop.
- Neue native Styling-Abhängigkeiten.
- Eine zweite parallele Theme-API neben dem neuen Provider.
- Ein vollständiges visuelles Redesign der App.
- Änderung der Datenbank, RLS, Offline-Synchronisierung oder Supabase-Schemas.

## Quellen und Einordnung

Die drei damals extern bereitgestellten Dateien wurden während der Migration als
Referenzcode ausgewertet:

- `index.ts`: Referenz für die Form des heutigen Tokenmoduls, nicht für dessen Palette.
- `ThemeProvider.tsx`: Referenz für den heutigen Provider, `useTheme()` und
  `useThemedStyles()`; Storage- und Importpfade wurden an fam angepasst.
- `ui.tsx`: Referenz für die heutigen primitiven UI-Verträge und die bewusste
  Reihenfolge von Default-, Zustands- und Caller-Styles.

`src/lib/haptics.ts` ist die vorgesehene fam-seitige Haptics-Quelle. Die Haptics-Logik wird nicht nochmals in `ui.tsx` dupliziert.
