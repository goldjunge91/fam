# Vertrag: NativeWind und StyleSheet

## Zweck

Die Hybridlösung teilt Verantwortung nach Art des Werts. Sie ist eine Lösung,
keine Auswahl zwischen zwei Styling-Systemen.

## NativeWind

- statisches Flexbox-Layout
- feste Abstände und Ausrichtung
- statische Größen, Positionen und Zustandsklassen
- projektweit definierte, bekannte Utilities

## Style und StyleSheet

- Themefarben aus `useTheme()`
- berechnete Maße und Laufzeitwerte
- `StyleProp` an Komponenten ohne NativeWind-Interop
- Schatten, native Spezialwerte und `useThemedStyles()`

## Vertrag umgesetzt

```tsx
const { colors } = useTheme();

<View
  className="flex-row items-center gap-two"
  style={{ backgroundColor: colors.backgroundSoft }}
/>
```

## Vertrag nicht umgesetzt

```tsx
<View className={`bg-[${colors.background}] ${active ? color : other}`} />
```

Dynamisch zusammengesetzte Klassen sind für den Compiler nicht zuverlässig
auffindbar. Der Referenz-Screen **Hybrid** zeigt die Aufgabenteilung und
`withAlpha()` für eine transparente Ableitung.
