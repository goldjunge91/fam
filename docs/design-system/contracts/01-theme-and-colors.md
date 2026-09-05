# Vertrag: Theme und Farben

## Zweck

Light, Dark und System verwenden dieselben semantischen Rollen. Screens kennen
nicht den Hexwert, sondern die Aufgabe einer Farbe.

## Zentrale Variablen

- `Colors.light`, `Colors.dark`, `colorsLight`, `colorsDark`
- `Palette`
- `makeAccent()` und `AccentKey`
- `makeCategoryTone()` und `CategoryToneKey`
- `ThemeProvider`, `useTheme()`, `mode`, `pref`, `setPref()`

Alle aktuellen Schlüssel werden im Referenz-Screen in den Kategorien **Theme**
und **Farben** automatisch aus den echten Objekten aufgelistet.

## Vertrag umgesetzt

```tsx
const { colors } = useTheme();

<Surface tone="surface">
  <Txt>Vorrat</Txt>
  <Txt tone="secondary">12 Produkte</Txt>
</Surface>
```

## Vertrag nicht umgesetzt

```tsx
<View style={{ backgroundColor: '#FFFFFF' }}>
  <Txt color="#2FBF71">Vorrat</Txt>
</View>
```

Der Hintergrund reagiert nicht auf Dark Mode und das Grün besitzt keine
semantische Aufgabe. Im Referenz-Screen ist dieser Fall rot markiert.

