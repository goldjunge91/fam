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

Die für `rs()` relevante Fensterbreite wird reaktiv berücksichtigt. React Native
0.86 stellt dafür `useWindowDimensions()` bereit. Werte, die von Fensterbreite,
Höhe oder Schriftfaktor abhängen, werden bei Rotation, Fenster-Resize und
Schriftfaktoränderungen neu berechnet; ein einmaliges Lesen beim Modulimport
erfüllt diesen Vertrag nicht.

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

- Fensterabhängig verändern sich Anordnung, Umbruch und nutzbare Breite.
  Benötigte Maße werden reaktiv gelesen, nicht einmalig beim Modulimport.
- Bestehende `SCREEN_W`-/`IS_TABLET`-Konstanten dürfen keine laufend veränderliche
  Geometrie oder globale Schrift-/Abstandsskala mehr steuern.
- `CONTENT_MAX_WIDTH = 600` bleibt Ausgangspunkt für lesbare Inhaltsbreite.
  Ein allgemeines Tablet-Redesign ist nicht Teil dieses Vertrags.
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
zeigt die tatsächlichen Werte. Schmale Breite, größere Schrift, Rotation und
Web-Resize belegen adaptive Anordnung ohne Neustart, ohne Touchziele unter
44 × 44. Der Screenvertrag prüft zusätzlich unteren Freiraum, Tastatur und
Scrollverantwortung.
