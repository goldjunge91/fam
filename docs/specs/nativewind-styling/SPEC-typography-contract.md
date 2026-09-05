# Spec: `typography-contract`

## Objective

`Txt` ersetzt `ThemedText` mit einer vollständigen und eindeutigen Fam-Typografie. Schriftgröße, Zeilenhöhe, Stärke und Farbe sollen nicht mehr aus einer Kombination widersprüchlicher `type`-Klassen und Caller-Klassen entstehen.

## Öffentliche API

```tsx
<Txt variant="body" tone="primary">Einkaufsliste</Txt>
<Txt variant="heading" tone="secondary">Diese Woche</Txt>
<Txt variant="label" weight="700">Speichern</Txt>
```

`Txt` akzeptiert die üblichen React-Native-`TextProps`. Zusätzlich sind erlaubt:

- `variant`: Schlüssel aus der vollständigen Fam-Typografie.
- `tone`: `primary`, `secondary`, `accent`, `onAccent`, `success`, `warning`, `danger`, `inverse`.
- `weight`: typisiertes `TextStyle['fontWeight']`.
- `center`: boolescher Convenience-Prop.
- `muted`: kompatibler Alias für `tone="secondary"`, nur während der Migration.
- `className`: primär für Layout und dokumentierte, nicht konkurrierende Utilities.

Ein freier `color`-Prop bleibt nur für berechnete Sonderfälle oder externe Icon-/Statusadapter zulässig. Normaler Text verwendet `tone`.

## Rollen und Werte

Die öffentliche API entspricht dem kleinen Waivy-Modell und besteht aus genau
sieben allgemeinen Rollen. Fam ergänzt lediglich sichere Zeilenhöhen.

| Variant | Fam-Wert | Default-Gewicht | Default-Ton |
| --- | ---: | ---: | --- |
| `display` | 48 / 52 | 800 | primary |
| `title` | 32 / 44 | 800 | primary |
| `heading` | 20 / 26 | 700 | primary |
| `subheading` | 17 / 24 | 700 | primary |
| `body` | 16 / 22 | 400 | primary |
| `label` | 13 / 17 | 600 | primary |
| `caption` | 12 / 15 | 500 | primary |

Die Schreibweise `fontSize / lineHeight` ist Teil des Vertrags. Ein Style darf die Schriftgröße nicht ändern, ohne die passende Zeilenhöhe zu prüfen.

## Zuordnung entfernter Rollen

| Alte Rolle | Neue Form |
| --- | --- |
| `default`, `small`, `body`, `bodySmall`, `bodyLarge`, `bodyRelaxed`, `controlValue*` | `variant="body"` |
| `smallBold`, `bodyBold` | `variant="body" weight="700"` |
| `smallMuted`, `bodyMuted` | `variant="body" tone="secondary"` |
| `smallSelected` | `variant="body" tone="accent"` |
| `smallDanger` | `variant="body" tone="danger"` |
| `controlAction*`, `stepperAction*` | `variant="subheading"` oder interner Komponentenstil |
| `pageTitle*`, `chromeTitle`, `ringValue`, `metricValue`, `navigationArrow` | `variant="title"` oder interner Komponentenstil |
| `pageSubtitle` | `variant="label"` |
| `caption`, `captionMuted` | `variant="caption"`, zusätzlich `tone="secondary"` für muted |
| `captionCompact`, `micro`, `detail`, `meta`, `code` | `variant="caption"` |
| `label`, `labelBold`, `labelMuted` | `variant="label"`, Gewicht oder Ton explizit |
| `link` | `variant="label" tone="accent"` |

Komponentenspezifische Größen bleiben intern bei `Button`, `QuantityStepper`,
`ProgressRing` oder Eingabekomponenten. Sie erweitern `TxtVariant` nicht.

## Style-Priorität

1. Variant-Default aus `Typography`.
2. Ton, Gewicht und Alignment aus typisierten Props.
3. NativeWind-`className` für Layout oder ausdrücklich erlaubte Utilities.
4. Caller-`style` zuletzt.

Wenn `style` `fontSize`, `lineHeight`, `fontWeight` oder `color` überschreibt, ist das eine bewusste lokale Ausnahme. Semantische Konflikte werden nicht über `!text-*` gelöst.

## Acceptance criteria

- [x] `TxtVariant` enthält genau sieben allgemeine Rollen.
- [x] Entfernte Rollen besitzen keine produktiven Aufrufer mehr.
- [x] Keine `any`-Typen für Gewicht, Style oder Children.
- [x] RNTL-Tests prüfen Variant- und Tone-Auflösung sowie Caller-Style als letzten Style-Eintrag.
- [x] Alle Production-Importe von `ThemedText` sind migriert; die alte Datei wurde nach der manuellen Maintainer-Freigabe entfernt.
