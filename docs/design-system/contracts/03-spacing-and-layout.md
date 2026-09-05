# Vertrag: Spacing und Layout

## Zweck und Zuständigkeit

Wiederkehrende Abstände und Maße stammen aus `src/components/theme/index.ts`.
NativeWind beschreibt einfaches statisches Layout. Features besitzen ihr lokales
Layout; gemeinsame Komponentenmaße und Darstellungsrezepte werden zentral gehalten.

## Verbindliche Abstandsskala

| Token | Logische Einheiten |
| --- | ---: |
| `space.xs` | 4 |
| `space.sm` | 8 |
| `space.md` | 12 |
| `space.lg` | 16 |
| `space.xl` | 20 |
| `space.xxl` | 28 |
| `space.xxxl` | 40 |

Die Werte sind die gemeinsame Referenz bei Designfaktor 1,0. `rs()` bleibt die
zentrale, begrenzte Skalierung für wiederkehrende Abstände und Maße; dargestellte
Werte dürfen deshalb geräteabhängig von der Referenz abweichen. Eine zusätzliche
lokale Skalierung oder eine zweite Tokenquelle ist nicht zulässig.

Die für `rs()` relevante Fensterbreite wird wie in Waivy einmalig mit
`Dimensions.get('window').width` beim Modulimport gelesen. Der Faktor bleibt
auf `0,9` bis `1,06` begrenzt. Dieser Vertrag verlangt keine zusätzliche
`useWindowDimensions()`-Schicht für die globalen `space`-Tokens und behauptet
keine Reaktivität der importierten Skala bei Rotation oder Web-Resize.

Bei einer begrenzten Inhaltsspalte wird deren verfügbare Breite als Grundlage
verwendet. Zusätzliche Fensterbreite darf die Abstände nicht unnötig vergrößern.
Umbruch, flexible Anordnung und ein begrenztes Wachstum sind gegenüber einer
proportionalen Vergrößerung der gesamten UI zu bevorzugen.

Bestehende statische NativeWind-Utilities dürfen weiterverwendet werden. Für
wiederkehrende Abstände ist der numerische Tokenwert maßgeblich, nicht eine
angenommene Gleichheit zwischen Namen wie `gap-three` und `space.md`. Derselbe
wiederkehrende Abstand muss denselben Wert besitzen. Neue gemeinsame Abstände
werden nicht zusätzlich in `tailwind.config.js` definiert.

Ein einmaliger begründeter Layoutwert ist erlaubt. Wiederholt sich die Entscheidung,
wird sie als gemeinsames Maß zentralisiert. Es ist kein Ziel, jeden einzelnen
Pixelwert eines Screens in ein neues Token umzuwandeln.

## Responsive Anordnung und gemeinsame Maße

- `SCREEN_W` und `IS_TABLET` dienen der groben Einordnung; `SCREEN_W` wird aus `Dimensions.get('window').width` abgeleitet.
- `CONTENT_MAX_WIDTH = 600` begrenzt die lesbare Spalte. Sie bleibt auf kleinen Geräten 100 Prozent breit, wird auf größeren Geräten zentriert und nicht durch
  ein allgemeines Tablet-Redesign ersetzt.
- Laufzeitabhängige Geometrie darf eine konkrete Komponente mit ihrem eigenen
  Hook ermitteln. Daraus entsteht keine zweite globale Skala.
- Normale eigenständige Aktionen besitzen unabhängig von `rs()` mindestens
  44 × 44 tatsächliche Touchfläche. Keine Skalierungsstufe darf ein Touchziel
  darunter verkleinern. Details zu sichtbarer Fläche und Treffern stehen in
  [Vertrag 07](./07-buttons-and-interaction.md).
- Gemeinsame Header-, Button- und Aktionsmaße gehören in die zentralen Quellen.
  Native Safe-Area-Werte bleiben Laufzeitwerte und werden genau einmal berücksichtigt.
- Gap zwischen FlashList-Zeilen wird durch `ItemSeparatorComponent` erzeugt;
  dessen `contentContainerStyle` ist kein Ersatz für Zeilentrennung.

## Beispiel der vorgesehenen Verwendung

```tsx
import { View } from 'react-native';
import { space } from '@/components/theme/index';

<View className="flex-row items-center" style={{ gap: space.md }}>
  {children}
</View>
```

Ein wiederkehrendes `gap: 11` mit jeweils anderen lokalen Randabständen erzeugt
Drift. Eine starre Höhe, die bei großer Schrift benötigte Inhalte abschneidet,
ist ebenfalls ein Vertragsbruch.

## Nachweis

Tokenprüfungen belegen die Basisskala und die Grenzen von `rs()`. Die Referenz
zeigt die tatsächlichen Werte sowie die zentrierte `CONTENT_MAX_WIDTH`-Spalte.
Schmale Breite, größere Schrift, Safe Area, Keyboard-Freiraum und
Scrollverantwortung werden am Screen geprüft. Rotation und Web-Resize gelten
nicht als Reaktivitätsnachweis für importierte Theme-Tokens.
