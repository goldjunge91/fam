# Vertrag: Surfaces und Cards

## Zweck

`Surface` setzt eine semantische Hintergrundrolle. `Card` gruppiert inhaltlich
zusammengehörende Informationen. Ein `View` bleibt die Wahl für reines Layout.
Feature-Cards verwenden dieselbe sichtbare Foundation aus Hintergrund, Border,
Radius und Schatten. Sie unterscheiden sich nur durch ihren Inhalt.

## Surface-Töne

- `page`
- `surface`
- `soft`
- `accent`

`selected` ist kein Surface-Ton. Auswahl ist ein Zustand der jeweiligen
interaktiven Komponente und wird dort mit `accessibilityState`, Akzent, Border
oder Symbol ausgedrückt.

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
