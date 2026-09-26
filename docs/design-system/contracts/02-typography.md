# Vertrag: Typografie

## Zweck und Zuständigkeit

Eine `Txt`-Variante bündelt Schriftgröße, Zeilenhöhe, Gewicht und Standardton.
Die Skalenwerte (`font`, `Fonts`) liegen in `src/components/theme/index.ts`;
`ui.tsx` bildet sie in `Txt` auf öffentliche Rollen und die aktive Palette ab.
Im aktuellen `TXT`-Register greifen sieben Varianten auf `font.sizes` und
`font.lineHeights` zurück. `brand`, `navigation`, `eyebrow` und `glyph` legen
ihre Maße direkt in `ui.tsx` fest; dort sind derzeit auch die Gewichte aller
Varianten angegeben.

## Öffentliche Varianten und aktuelle Maße

Die folgenden Werte gelten bei Referenzbreite 393 und Systemschriftfaktor 1,0.
`rs()`-basierte Theme-Werte passen sich begrenzt an die Fensterbreite an.

| Variante | Größe / Zeilenhöhe | Gewicht | Basiston | Quelle der Maße |
| --- | ---: | ---: | --- | --- |
| `display` | 48 / 52 | 800 | `text` | `font.sizes.xxxl`, `font.lineHeights.display` |
| `title` | 32 / 44 | 800 | `text` | `font.sizes.xxl`, `font.lineHeights.title` |
| `brand` | 27 / 34 | 600 | `text` | direkt in `ui.tsx` |
| `heading` | 20 / 26 | 700 | `text` | `font.sizes.lg`, `font.lineHeights.heading` |
| `subheading` | 17 / 24 | 700 | `text` | `font.sizes.md`, `font.lineHeights.subheading` |
| `body` | 16 / 22 | 400 | `text` | `font.sizes.base`, `font.lineHeights.body` |
| `navigation` | 17 / 21 | 400 | `text` | direkt in `ui.tsx` |
| `label` | 13 / 17 | 600 | `text` | `font.sizes.sm`, `font.lineHeights.label` |
| `caption` | 12 / 15 | 500 | `text` | `font.sizes.xs`, `font.lineHeights.caption` |
| `eyebrow` | 12 / 15 | 400 | `textSecondary` | direkt in `ui.tsx`, letter spacing 0,76 |
| `glyph` | 22 / 26 | 400 | `textSecondary` | direkt in `ui.tsx` |

`TxtVariant` exportiert elf öffentliche Varianten. Die Tabelle beschreibt den
aktuellen Stand in `ui.tsx` und `index.ts`; sie erfindet keine zusätzlichen
Varianten. Wiederkehrende Textrollen werden über diese Varianten oder zentrale
Komponentenrezepte ausgedrückt, nicht lokal pro Screen zusammengesetzt.

## Begrenzte Skalierung, Systemschrift und verfügbare Breite

`rs()` bleibt die zentrale, begrenzte Designskalierung für die gemeinsamen
Schrift- und Zeilenhöhen. Die Werte in der Basisskala sind die gemeinsame
Referenz bei Faktor 1,0; die dargestellten Werte dürfen davon geräteabhängig
abweichen. Die Skalierung muss moderat bleiben und darf keine zweite lokale
Typografieskala erzeugen.

Die relevante Fensterbreite wird
mit `Dimensions.get('window').width` einmalig beim Modulimport gelesen. Die
Skalierung ist dadurch bewusst einfach und begrenzt. Dieser Vertrag verlangt
keine zusätzliche `useWindowDimensions()`-Schicht und behauptet keine reaktive
Neuberechnung der importierten Typografiewerte bei Rotation oder Web-Resize.

Eine begrenzte Inhaltsspalte darf zusätzliche Fensterbreite nicht unnötig in
größere Schrift umsetzen. Lesbare Umbrüche und eine flexible Anordnung haben
Vorrang vor dem Versuch, jeden Text durch `rs()` passend zu machen.

Die Systemschrift-Einstellung bleibt aktiv. Die Designskalierung darf die vom
Nutzer eingestellte Schriftvergrößerung weder deaktivieren noch kompensieren;
pauschale `maxFontSizeMultiplier`-Limits oder kleinere Schrift zum Einpassen
sind nicht zulässig.

Bei Faktor 2,0 und schmaler Breite bleiben notwendige Inhalte und Aktionen
zugänglich. Zeilenhöhe, Container und Buttons dürfen mitwachsen. Lange Überschriften
werden nicht durch starre Headerhöhen abgeschnitten. Gezielte Kürzung von
Listentext ist erlaubt, wenn die vollständige Information zugänglich erreichbar
bleibt; Fehlermeldungen dürfen nicht pauschal einzeilig abgeschnitten werden.

Die kleinsten Texte werden mit der tatsächlichen Darstellung geprüft: Aus
`rs(12)` können auf einem schmalen Gerät 11 Punkte werden. Ob diese Größe für
Metadaten ausreichend lesbar ist, wird an der Referenzdarstellung und nicht
anhand des Skalierungsfaktors allein entschieden. Die statische Berechnung von
`rs()` ist ein bewusst übernommenes Implementierungsmuster, kein offener
Migrationsfehler.

## Overrides und alte Rollen

- `className` ist verboten. `style` darf lokales Layout wie Breite, Ausrichtung
  oder Abstand beitragen, ist aber keine Erlaubnis für neue Schriftgrößen oder Textfarben.
- `Txt.variant` besitzt Schriftgröße, Zeilenhöhe, Grundgewicht und Grundton. Die
  Option `weight` darf das Gewicht eines einzelnen Textes lokal hervorheben,
  ohne die übrige Variante zu verändern. `color` bleibt für kompatible Aufrufer
  und begründete Integrationsgrenzen verfügbar.
- Eine lokale Hervorhebung beschreibt genau diese Textstelle, etwa einen
  ausgewählten Wert oder eine Zahl innerhalb einer bestehenden Textrolle. Sie
  ist kein Ersatz für eine wiederkehrende semantische Rolle und darf keine neue
  Schriftgröße, Schriftfamilie oder Textfarbe pro Screen festlegen.
- Wiederholt sich dieselbe sichtbare Rolle über mehrere Flächen, gehört ihre
  Darstellung in eine vorhandene `Txt`-Variante oder ein zentrales Rezept in
  `ui.tsx`. Eine gleiche Kombination aus `variant`, `tone` und `weight` genügt
  allein nicht als Beleg für dieselbe Rolle: `body` mit `weight="700"` wird
  unter anderem für Auswahlwerte, Stepper-Zahlen und Kennzahlen genutzt. Diese
  Aufrufer behalten ihre lokale Betonung, solange sie nicht dieselbe
  Nutzeraufgabe und Darstellung teilen.
- Ein `weight`-Override, der dem Grundgewicht der Variante entspricht, ändert
  die Darstellung nicht. Bestehende explizite Wiederholungen werden nicht
  pauschal entfernt; neue Aufrufer sollen sie nur setzen, wenn der lokale
  Hervorhebungsgrund sichtbar ist.
- Fontfamilien werden aus den zentralen plattformgerechten Werten gewählt.
  Eine zusätzliche lokale Fontpalette wird nicht eingeführt.

| Alte Rollen | Vorgesehene Form |
| --- | --- |
| `bodySmall`, `bodyLarge`, `bodyRelaxed`, `controlValue*` | `body` oder begründetes zentrales Komponentenrezept |
| `controlAction*`, `stepperAction*` | `subheading` oder zentrales Komponentenrezept |
| `pageTitle*`, `chromeTitle`, `ringValue`, `metricValue`, `navigationArrow` | `title` oder zentrales Komponentenrezept |
| `pageSubtitle` | `label` |
| `micro`, `meta`, `detail`, `captionCompact`, `code` | `caption` |
| `link` | `label` mit `tone="accent"` |

## Beispiel der vorgesehenen Verwendung

```tsx
import { Txt } from '@/constants/ui';

<Txt variant="subheading">Frühstück</Txt>
<Txt variant="body" tone="secondary">0 kcal</Txt>
```

`<Txt style={{ fontSize: 20, lineHeight: 16 }}>` ist keine zulässige Korrektur
eines Screens. Die Zeilenhöhe kann Glyphen abschneiden und umgeht das Rezept.

## Nachweis

Die Referenz zeigt alle elf Varianten und unterstützten Töne in Light/Dark.
Tokenprüfungen belegen die in `index.ts` gespeicherten Werte; direkt in `ui.tsx`
definierte Variantenmaße sind in der Tabelle ausgewiesen. Native Prüfung mit
normaler und großer Systemschrift belegt Umbruch, vollständige Glyphen und
erreichbare Aktionen. Rotation und Resize dürfen die Basisschriftgröße nicht
verändern.
