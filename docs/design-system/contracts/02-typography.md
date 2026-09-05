# Vertrag: Typografie

## Zweck

Eine `Txt`-Variante bündelt Schriftgröße, Zeilenhöhe, Gewicht und Standardton.
So werden Überschriften nicht abgeschnitten und bleiben über Screens hinweg
gleich.

## Quellen der Wahrheit

- Schriftmaße und Gewichte: `src/components/theme/index.ts`
- Varianten, Töne und Textdarstellung: `src/constants/ui.tsx`
- `font.sizes`, `font.lineHeights`, `font.weight`
- `TxtVariant`
- `TxtTone`
- optionale Overrides `weight`, `color`, `center`, `style`

Der Referenz-Screen **Typografie** zeigt jede öffentliche Variante und jeden
Ton. Komponenteninterne Beschriftungen sind keine globale `Txt`-Variante.
NativeWind und `global.css` definieren keine zusätzliche Typografie-API.

## Öffentliche `Txt`-API

```ts
type TxtVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'label'
  | 'caption';
```

## Verbindliche Rezepte

| Variante | Größe / Zeilenhöhe | Gewicht | Zweck |
| --- | ---: | ---: | --- |
| `display` | 48 / 52 | 800 | einzelne große Kennzahl oder Hero-Text |
| `title` | 32 / 44 | 800 | Screen- und große Bereichstitel |
| `heading` | 20 / 26 | 700 | Abschnittsüberschrift |
| `subheading` | 17 / 24 | 700 | untergeordnete Überschrift |
| `body` | 16 / 22 | 400 | normaler Inhalt |
| `label` | 13 / 17 | 600 | Beschriftung und Link |
| `caption` | 12 / 15 | 500 | Metadaten und kleine Hinweise |

Die Werte werden responsiv über `rs()` skaliert. Die expliziten Zeilenhöhen
sind die einzige bewusste Abweichung vom noch einfacheren Waivy-Modell. Sie
verhindern erneut abgeschnittene Glyphen.

## Nicht mehr zulässige Varianten

| Alte Rollen | Erlaubte Form |
| --- | --- |
| `bodySmall`, `bodyLarge`, `bodyRelaxed`, `controlValue*` | `body` |
| `controlAction*`, `stepperAction*` | `subheading` oder komponentenspezifisches Typografierezept aus `src/constants/ui.tsx` |
| `pageTitle*`, `chromeTitle`, `ringValue`, `metricValue`, `navigationArrow` | `title` oder komponentenspezifisches Typografierezept aus `src/constants/ui.tsx` |
| `pageSubtitle` | `label` |
| `micro`, `meta`, `detail`, `captionCompact`, `code` | `caption` |
| `link` | `label` mit `tone="accent"` |

## Zuständigkeiten

- `ScreenHeader` verwendet `title` und optional `label`.
- Button-Beschriftungen wenden intern ihr zentral in `src/constants/ui.tsx`
  definiertes Rezept an.
- Eingaben, Stepper und Kennzahlen dürfen ein dort definiertes Rezept wählen,
  aber keine lokale Schriftgröße, Zeilenhöhe, Stärke oder Farbe aus Rohtokens
  zusammensetzen.
- Screens verwenden für wiederkehrende Texte ausschließlich die sieben
  öffentlichen Varianten.

## Vertrag umgesetzt

```tsx
<Txt variant="subheading">Frühstück</Txt>
<Txt variant="body" tone="secondary">0 kcal</Txt>
```

## Vertrag nicht umgesetzt

```tsx
<Txt style={{ fontSize: 20, lineHeight: 16, fontWeight: '700' }}>
  Frühstück
</Txt>
```

Die Zeilenhöhe ist kleiner als die Schrift und kann Glyphen abschneiden. Der
Screen wählt eine vorhandene Variante. Eine wiederverwendbare Komponente darf
ein zentrales Rezept auswählen, aber keine eigene Typografiedefinition besitzen.
