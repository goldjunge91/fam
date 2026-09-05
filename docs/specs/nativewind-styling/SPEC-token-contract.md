# Spec: `token-integrity`

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
| `scrim` | dokumentierter Fam-Ableitungswert über `withAlpha` |

Es ist nicht erlaubt, die ui-Hexwerte als Ersatz oder Fallback einzubauen.

## Required API

```ts
type ThemeMode = 'light' | 'dark';
type ThemePref = 'system' | 'light' | 'dark';

type FamPalette = {
  background: string;
  backgroundElement: string;
  backgroundSoft: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
  onAccent: string;
  success: string;
  warning: string;
  danger: string;
  shadowCard: string;
  shadowSheet: string;
};
```

Die konkrete Typdefinition darf zusätzliche bestehende Premium- und Gradient-Tokens enthalten. Jeder neue Token benötigt eine semantische Verwendung und einen Light-/Dark-Wert.

## Layout- und Typografie-Tokens

- `space`: Ableitung aus `Spacing` mit stabilen Namen `xs`, `sm`, `md`, `lg`, `xl`, `xxl`.
- `radius`: Ableitung aus `Radius`, ohne neue parallele Radius-Skala.
- `font`: Ableitung aus `Typography` und `Fonts`.
- `shadow`: semantische Elevations `none`, `sm`, `md`, `lg`, mit platformgerechten Werten.
- `BUTTON_DEPTH`: ist die zentrale 4pt-Tiefe und der vollständige 4pt-Druckweg
  für gefüllte 3D-Buttons. Beide Button-APIs beziehen sichtbare Tiefe und
  Press-Bewegung aus diesem Theme-Token.

## Tokenregeln

- Keine Hexwerte in Screens, wenn ein semantischer Token existiert.
- Keine direkte Verwendung von `colorsLight` als UI-Fallback außerhalb der Provider-Auflösung.
- Keine Farbklasse, die in `tailwind.config.js` nicht registriert ist.
- Für Alpha-Farben `withAlpha()` verwenden.
- Text- und Hintergrundsemantik nicht über eine versehentliche inverse Zuordnung lösen.
- Statusfarben bleiben zusätzlich textlich oder per Symbol erkennbar.

## Acceptance criteria

- [x] `index.ts` exportiert eine einzige Fam-Palette und die benötigten Layout-/Typografie-Tokens.
- [x] Keine ui-Farbwerte erscheinen in Production-Defaults.
- [x] Light und Dark besitzen dieselben semantischen Schlüssel.
- [x] Token-Schlüssel und Tailwind-Semantik sind entweder identisch oder über eine dokumentierte Mapping-Tabelle verbunden.
- [x] Unit-Tests prüfen Schlüsselparität und zentrale Mappings.
