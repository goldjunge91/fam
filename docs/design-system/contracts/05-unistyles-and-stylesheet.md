# Vertrag: Unistyles und StyleSheet

## Zweck

`react-native-unistyles` v3 ist die einzige aktive Styling-Runtime.
NativeWind ist entfernt. Die drei zentralen Quellen aus der [README](./README.md)
besitzen das Design-System; Styles werden über typisierte Theme-Callbacks erstellt.

## Styling-Runtime

Der kanonische Weg für alle neuen und migrierten Styles:

```tsx
import { StyleSheet } from 'react-native-unistyles';

const styles = StyleSheet.create((theme) => ({
  root: {
    backgroundColor: theme.background,
    borderColor: theme.border,
    padding: theme.space.md,
  },
}));
```

`className` und `contentContainerClassName` sind verboten.
`global.css` und `tailwind.config.js` sind Retirement-Dateien und besitzen
keine aktiven semantischen Klassen, Paletten oder Zustände.

## Zuständigkeiten

| Bereich | Zulässig |
| --- | --- |
| `index.ts` | Tokens, Paletten, Abstände, Radien, Schriftmaße, Unistyles-Theme-Konfiguration |
| `ThemeProvider.tsx` | Aktive Palette, Laufzeitauflösung `system/light/dark`, `useTheme()` |
| `ui.tsx` | Typografie, Farbpaare, Flächen, Konturen, Schatten, Interaktionszustände |
| Komponenten-/Feature-StyleSheet | Nichtsemantisches lokales Layout, berechnete Geometrie, native Integrationswerte |

Keine vierte globale Theme- oder Style-Quelle. Keine `vars()`-Bridge.
Semantische Entscheidungen gehören in genau eine der drei zentralen Dateien.

## Integrationsausnahmen

Native Views ohne Unistyles-Interop verwenden ihre tatsächliche `style`-/Prop-API —
FlashList, Bottom Sheets, SVG, `expo-image`, Reanimated. Palette und semantische
Rezepte stammen weiterhin aus den drei zentralen Quellen.

Medien, offizielle Produktkennzeichnungen, nutzergewählte Farben und Systemcontrols
werden nicht pauschal in die fam-Palette umgefärbt.

Für jede Ausnahme wird in diesem Vertrag ein Eintrag mit **Pfad, Plattform, Grund,
betroffener Regel und Prüffall** dokumentiert.

## Beispiel

```tsx
import { StyleSheet } from 'react-native-unistyles';
import { Surface } from '@/constants/ui';

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
  },
}));

<Surface tone="soft" style={styles.row} />
```

## Nachweis und Abschluss

Eine vollständige Migration hat keine unbegründeten aktiven `className`-Verbraucher.
Prüfung: repo-weiter `rg`-Scan für `className=` und `contentContainerClassName=`
in `src/` — ausgenommen historische Docs und explizit begründete Ausnahmen.
