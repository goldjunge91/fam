# Vertrag: Typografie

## Zweck und Zuständigkeit

Eine `Txt`-Variante bündelt Schriftgröße, Zeilenhöhe, Gewicht und Standardton.
Schriftmaße, Gewichte und vorhandene Fontfamilien (`font`, `Fonts`) stammen aus
`index.ts`. Die Anwendung auf Text- und Komponentenrollen gehört nach `ui.tsx`.
CSS und NativeWind besitzen keine zusätzliche Typografie-API.

## Verbindliche Basisskala

Die folgenden Werte gelten in logischen Einheiten bei Systemschriftfaktor 1,0:

| Variante | Größe / Zeilenhöhe | Gewicht | Zweck |
| --- | ---: | ---: | --- |
| `display` | 48 / 52 | 800 | einzelne große Kennzahl oder hervorgehobener Text |
| `title` | 32 / 44 | 800 | Screen- und große Bereichstitel |
| `heading` | 20 / 26 | 700 | Abschnittsüberschrift |
| `subheading` | 17 / 24 | 700 | untergeordnete Überschrift |
| `body` | 16 / 22 | 400 | normaler Inhalt |
| `label` | 13 / 17 | 600 | Beschriftung und Link |
| `caption` | 12 / 15 | 500 | Metadaten und kleine Hinweise |

Die sieben öffentlichen Varianten bleiben unverändert. Komponenteninterne
Beschriftungen, Eingaben und Kennzahlen können eigene zentrale Rezepte besitzen,
ohne neue öffentliche `Txt`-Varianten einzuführen. Sie werden nicht lokal aus
Schriftgröße, Gewicht und Farbe zusammengesetzt.

## Begrenzte Skalierung, Systemschrift und verfügbare Breite

`rs()` bleibt die zentrale, begrenzte Designskalierung für die gemeinsamen
Schrift- und Zeilenhöhen. Die Werte in der Basisskala sind die gemeinsame
Referenz bei Faktor 1,0; die dargestellten Werte dürfen davon geräteabhängig
abweichen. Die Skalierung muss moderat bleiben und darf keine zweite lokale
Typografieskala erzeugen.

Die Skalierung berücksichtigt die relevante verfügbare Breite reaktiv. React
Native 0.86 stellt dafür `useWindowDimensions()` bereit; seine Werte aktualisieren
sich bei Rotation, Fenster-Resize und Änderungen des Schriftfaktors. Alle daraus
abgeleiteten Typografiewerte müssen anschließend neu berechnet und von den
Komponenten verwendet werden. Eine Breite, die nur einmal beim Modulimport
gelesen wird, erfüllt diesen Vertrag nicht.

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
anhand des Skalierungsfaktors allein entschieden. Das noch nicht reaktive
`rs()` im Code ist Migrationsbestand; diese Dokumentationsänderung behauptet
keine bereits erfolgte Codeumstellung.

## Overrides und alte Rollen

- `className` und `style` dürfen lokales Layout wie Breite, Ausrichtung oder Abstand
  beitragen. Sie sind keine Erlaubnis für neue Schriftgrößen oder Textfarben.
- Vorhandene `weight`, `color` und allgemeine Style-Props bleiben für kompatible
  Aufrufer und begründete Integrationsgrenzen verfügbar. Wiederkehrende semantische
  Abweichungen werden in einem zentralen Rezept ausgedrückt.
- Ein bewusst hervorgehobenes Label kann ein zentral definiertes Gewicht wählen.
  Eine andere Schriftgröße pro Screen ist keine zulässige Nutzung dieses Overrides.
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

Die Referenz zeigt alle sieben Varianten und unterstützten Töne in Light/Dark.
Tokenprüfungen belegen die Basisskala. Native Prüfung mit normaler und großer
Systemschrift belegt Umbruch, vollständige Glyphen und erreichbare Aktionen.
Rotation und Resize dürfen die Basisschriftgröße nicht verändern.
