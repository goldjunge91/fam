# Capability Map: Fam NativeWind Styling Stabilisierung

## Zweck

Diese Initiative stabilisiert die bestehende UI-Styling-Architektur von fam. NativeWind bleibt installiert und wird weiterverwendet. Die vorhandene Fam-Mauve-/Creme-Palette bleibt die visuelle Wahrheit. Die ui-Dateien dienen nur als Referenz für mögliche primitive Komponenten, nicht als neue Marke und nicht als neue Farbpalette.

## Module

| Module id | Verantwortung | Abhängigkeiten |
| --- | --- | --- |
| `token-integrity` | Eine typisierte, semantische Fam-Tokenquelle für Farben, Abstände, Radien, Typografie, Elevation und Zustände | bestehende `src/constants/theme.ts`, `src/constants/layout.ts` |
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

Die drei Dateien unter `/Users/marco/Downloads` werden als Referenzcode ausgewertet:

- `index.ts`: Referenz für die Form eines zentralen Tokenmoduls, nicht für dessen Palette.
- `ThemeProvider.tsx`: Referenz für Provider, `useTheme()` und `useThemedStyles()`. Storage- und Importpfade müssen an fam angepasst werden.
- `ui.tsx`: Referenz für primitive UI-Verträge und für die bewusste Reihenfolge von Default-, Zustands- und Caller-Styles. Komponentenbreite, Props und vorhandenes Verhalten bleiben erhalten. Nur vorhandene Fam-Gegenstücke, reale Imports, Haptics und leicht ersetzbare Typen werden angepasst.

`src/lib/haptics.ts` ist die vorgesehene fam-seitige Haptics-Quelle. Die Haptics-Logik wird nicht nochmals in `ui.tsx` dupliziert.
