# Spec: `token-integrity`

## Status

Abgeschlossen und historisch. Der aktuelle Tokenvertrag steht unter
`docs/design-system/contracts/`; die tatsächliche Tokenquelle ist ausschließlich
`src/components/theme/index.ts`.

## Objective

Die kanonische Theme-Datei darf keine zweite visuelle Sprache einführen. Sie stellt die bestehenden Fam-Farben und Layoutwerte unter einer typisierten, semantischen API bereit, damit UI-Primitiven nicht mehr frei zwischen Tailwind-Klassen, Hexwerten und alten `Colors`-Objekten wählen.

## Kanonische Tokenquelle

`src/components/theme/index.ts` ist die einzige öffentliche Tokenquelle der UI-Primitiven. Der frühere parallele Bestand in `src/constants/theme.ts` wurde nach der Migration entfernt. Danach darf kein zweiter, abweichender Tokenbestand bestehen.

Die ui-Referenznamen werden nur als mögliche Form verwendet:

| Referenzkonzept | Fam-Token |
|---|---|
| `bg` | `background` aus `Colors` |
| `surface` | `backgroundElement` aus `Colors` |
| `soft` | `backgroundSoft` aus `Colors` |
| `text` | `text` |
| `textMuted` | `textSecondary` |
| `border` | `border` |
| `basil` oder andere Akzentfarben | nicht übernehmen; `accent`, `success`, `warning`, `danger` aus Fam verwenden |
| `scrim` | vorhandenen semantischen Token direkt verwenden; `withAlpha()` nur für neue transparente Ableitungen |

Es ist nicht erlaubt, die ui-Hexwerte als Ersatz oder Fallback einzubauen.

## Tatsächliche Token-API

```ts
type Palette = { -readonly [K in keyof typeof colorsLight]: string };
```

`ThemeMode` und `ThemePref` gehören zur Runtime-API des `ThemeProvider`, nicht
zur Tokenquelle. `Palette` umfasst dadurch automatisch auch die bestehenden
Premium-, Gradient- und Kompatibilitätstokens. Jeder neue Token benötigt eine
semantische Verwendung und einen Light-/Dark-Wert.

## Layout- und Typografie-Tokens

- `space`: zentrale responsive Skala mit `xs`, `sm`, `md`, `lg`, `xl`, `xxl`
  und `xxxl`.
- `radius`: direkt in `src/components/theme/index.ts` definierte zentrale Skala,
  ohne parallele Radius-Skala.
- `font`: zentrale Größen, Zeilenhöhen und Gewichte; `Fonts` besitzt die
  Plattformfamilien.
- `shadow`: semantische Elevations `sm`, `md`, `lg`, mit plattformgerechten
  Werten.
- `BUTTON_DEPTH`: ist die zentrale 4pt-Tiefe und der vollständige 4pt-Druckweg
  für gefüllte 3D-Buttons. Beide Button-APIs beziehen sichtbare Tiefe und
  Press-Bewegung aus diesem Theme-Token.

## Tokenregeln

- Keine Hexwerte in Screens, wenn ein semantischer Token existiert.
- Keine direkte Verwendung von `colorsLight` als UI-Fallback außerhalb der Provider-Auflösung.
- Neue semantische Farben werden nicht als NativeWind-Farbklassen modelliert.
- Für Alpha-Farben `withAlpha()` verwenden.
- Text- und Hintergrundsemantik nicht über eine versehentliche inverse Zuordnung lösen.
- Statusfarben bleiben zusätzlich textlich oder per Symbol erkennbar.

## Acceptance criteria

- [x] `index.ts` exportiert eine einzige Fam-Palette und die benötigten Layout-/Typografie-Tokens.
- [x] Keine ui-Farbwerte erscheinen in Production-Defaults.
- [x] Light und Dark besitzen dieselben semantischen Schlüssel.
- [x] `src/global.css` und `tailwind.config.js` bilden keine zweite Tokenquelle.
- [x] Unit-Tests prüfen Schlüsselparität und zentrale Mappings.
