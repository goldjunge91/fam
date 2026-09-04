# Spec: `typography-contract`

## Objective

`Txt` ersetzt `ThemedText` mit einer vollständigen und eindeutigen Fam-Typografie. Schriftgröße, Zeilenhöhe, Stärke und Farbe sollen nicht mehr aus einer Kombination widersprüchlicher `type`-Klassen und Caller-Klassen entstehen.

## Öffentliche API

```tsx
<Txt variant="body" tone="primary">Einkaufsliste</Txt>
<Txt variant="headingSmall" tone="secondary">Diese Woche</Txt>
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

Die Zahlen kommen aus `src/constants/theme.ts` und werden nicht durch ui-Werte ersetzt.

| Variant | Fam-Wert | Default-Gewicht | Default-Ton |
| --- | ---: | ---: | --- |
| `micro` | 9 / 14 | 500 | secondary |
| `captionCompact` | 11 / 14 | 500 | secondary |
| `caption` | 11 / 15 | 500 | secondary |
| `detail` | 12 / 16 | 400 | secondary |
| `label` | 13 / 17 | 600 | primary |
| `bodySmall` | 14 / 20 | 400 | primary |
| `controlValue` | 15 / 20 | 400 | primary |
| `body` | 16 / 22 | 400 | primary |
| `bodyRelaxed` | 16 / 24 | 400 | primary |
| `controlValueLarge` | 17 / 22 | 400 | primary |
| `bodyLarge` | 18 / 24 | 400 | primary |
| `controlAction` | 20 / 22 | 600 | primary |
| `headingSmall` | 20 / 26 | 700 | primary |
| `controlActionLarge` | 22 / 24 | 600 | primary |
| `title` | 32 / 44 | 700 | primary |
| `display` | 48 / 52 | 700 | primary |
| `link` | 14 / 30 | 600 | accent |
| `code` | 12 / auto | 400 | primary |

Die Schreibweise `fontSize / lineHeight` ist Teil des Vertrags. Ein Style darf die Schriftgröße nicht ändern, ohne die passende Zeilenhöhe zu prüfen.

## Migration alter Rollen

| Alte Rolle | Neue Form |
| --- | --- |
| `default`, `small`, `body` | `variant="body"` |
| `smallBold`, `bodyBold` | `variant="body" weight="700"` |
| `smallMuted`, `bodyMuted` | `variant="body" tone="secondary"` |
| `smallSelected` | `variant="body" tone="accent"` |
| `smallDanger` | `variant="body" tone="danger"` |
| `title` | `variant="display"` zur visuellen Kompatibilität des alten `ThemedText` |
| `subtitle` | `variant="title"` |
| `caption`, `captionMuted` | `variant="caption"`, zusätzlich `tone="secondary"` für muted |
| `captionCompact`, `micro`, `detail` | gleichnamige Variante |
| `label`, `labelBold`, `labelMuted` | `variant="label"`, Gewicht oder Ton explizit |
| `controlValue`, `bodyLarge`, `headingSmall`, `link`, `code` | gleichnamige Variante |

Die verwirrende alte Bedeutung von `title` wird nicht in die neue API übernommen. Die Migration erhält zunächst das bestehende Erscheinungsbild und macht die neue Absicht sichtbar.

## Style-Priorität

1. Variant-Default aus `Typography`.
2. Ton, Gewicht und Alignment aus typisierten Props.
3. NativeWind-`className` für Layout oder ausdrücklich erlaubte Utilities.
4. Caller-`style` zuletzt.

Wenn `style` `fontSize`, `lineHeight`, `fontWeight` oder `color` überschreibt, ist das eine bewusste lokale Ausnahme. Semantische Konflikte werden nicht über `!text-*` gelöst.

## Acceptance criteria

- [ ] Jeder aktuelle `Typography`-Schlüssel ist in `Txt` verfügbar.
- [ ] `bodySmall` ist nicht mehr ohne Rolle oder ohne Mapping.
- [ ] Keine `any`-Typen für Gewicht, Style oder Children.
- [ ] RNTL-Tests prüfen Variant- und Tone-Auflösung sowie Caller-Style als letzten Style-Eintrag.
- [ ] Alle Production-Importe von `ThemedText` sind migriert, bevor die Datei gelöscht wird.
