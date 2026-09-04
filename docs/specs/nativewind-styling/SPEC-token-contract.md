# Spec: `token-integrity`

## Objective

Die neue Theme-Datei darf keine zweite visuelle Sprache einführen. Sie stellt die bestehenden Fam-Farben und Layoutwerte unter einer typisierten, semantischen API bereit, damit UI-Primitiven nicht mehr frei zwischen Tailwind-Klassen, Hexwerten und alten `Colors`-Objekten wählen.

## Kanonische Tokenquelle

`src/components/theme/index.ts` wird die einzige öffentliche Tokenquelle der neuen UI-Primitiven. Während der Migration dürfen Werte aus `src/constants/theme.ts` und `src/constants/layout.ts` dort importiert oder dorthin verschoben werden. Danach darf kein zweiter, abweichender Tokenbestand bestehen.

Die ui-Referenznamen werden nur als mögliche Form verwendet:

| Referenzkonzept | Fam-Token |
|---|---|
| `bg` | `background` aus `Colors` |
| `surface` | `backgroundElement` aus `Colors` |
| `surfaceSoft` | aus `backgroundSelected` oder einem dokumentierten Fam-Ableitungswert |
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
  backgroundSelected: string;
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
- `BUTTON_DEPTH`: bleibt als vorhandenes Verhalten der Referenzkomponente erhalten. Eine mögliche sichtbare Anpassung wird erst nach den zwei Screen-Mocks entschieden; daraus entsteht kein neuer globaler ui-Token.

## Tokenregeln

- Keine Hexwerte in Screens, wenn ein semantischer Token existiert.
- Keine direkte Verwendung von `colorsLight` als UI-Fallback außerhalb der Provider-Auflösung.
- Keine Farbklasse, die in `tailwind.config.js` nicht registriert ist.
- Für Alpha-Farben `withAlpha()` verwenden.
- Text- und Hintergrundsemantik nicht über eine versehentliche inverse Zuordnung lösen.
- Statusfarben bleiben zusätzlich textlich oder per Symbol erkennbar.

## Acceptance criteria

- [ ] `index.ts` exportiert eine einzige Fam-Palette und die benötigten Layout-/Typografie-Tokens.
- [ ] Keine ui-Farbwerte erscheinen in Production-Defaults.
- [ ] Light und Dark besitzen dieselben semantischen Schlüssel.
- [ ] Token-Schlüssel und Tailwind-Semantik sind entweder identisch oder über eine dokumentierte Mapping-Tabelle verbunden.
- [ ] Unit-Tests prüfen Schlüsselparität und zentrale Mappings.
