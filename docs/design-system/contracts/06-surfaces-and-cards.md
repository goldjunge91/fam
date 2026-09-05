# Vertrag: Surfaces und Cards

## Zweck

`Surface` setzt eine semantische Hintergrundrolle. `Card` gruppiert inhaltlich
zusammengehörende Informationen. Ein `View` bleibt die Wahl für reines Layout.
Feature-Cards verwenden dieselbe sichtbare Foundation aus Hintergrund, Border,
Radius und Schatten. Sie unterscheiden sich nur durch ihren Inhalt.

`Surface`, die gemeinsame Card-Foundation und ihre semantischen Hintergrund-,
Kontur-, Radius- und Schattenrezepte werden in `src/constants/ui.tsx` geregelt.
Höhere Card-Komponenten wenden diese Foundation an, statt direkt aus Rohtokens
einen zweiten semantischen Stil zusammenzusetzen. Feature-Code und NativeWind
definieren keine eigene Flächenpalette.

## Surface-Töne

- `page`
- `surface`
- `soft`
- `accent`

`selected` ist kein Surface-Ton. `src/constants/ui.tsx` definiert die
wiederverwendbare Darstellung ausgewählter Zustände; die interaktive Komponente
wendet sie an und setzt das passende `accessibilityState`.

## Vertrag umgesetzt

```tsx
<Card title="Vorrat">
  <Txt tone="secondary">12 Produkte, 2 laufen bald ab</Txt>
</Card>
```

## Vertrag nicht umgesetzt

```tsx
<View style={{ backgroundColor: '#fff', borderRadius: 32 }}>
  <View style={{ backgroundColor: '#eee', borderRadius: 25 }}>
    <Txt>Karte in Karte</Txt>
  </View>
</View>
```

Dekorative Verschachtelung reduziert Informationsdichte und besitzt keinen
semantischen Nutzen. Der Referenz-Screen **Flächen** zeigt alle Surface-Töne.
