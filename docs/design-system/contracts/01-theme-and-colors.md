# Vertrag: Theme und Farben

## Zweck

Light, Dark und System verwenden dieselben semantischen Rollen. Screens kennen
nicht den Hexwert, sondern die Aufgabe einer Farbe.

## Zentrale Variablen

Die Tokens stammen ausschließlich aus `src/components/theme/index.ts`. Der
aktive Modus und die aufgelöste Palette stammen ausschließlich aus
`src/components/theme/ThemeProvider.tsx`.

- `Colors.light`, `Colors.dark`, `colorsLight`, `colorsDark`
- `Palette`
- `makeAccent()` und `AccentKey`
- `makeCategoryTone()` und `CategoryToneKey`
- `ThemeProvider`, `useTheme()`, `mode`, `pref`, `setPref()`

NativeWind, `global.css` und `tailwind.config.js` besitzen keine eigene
Theme-Palette.

Alle aktuellen Schlüssel werden im Referenz-Screen in den Kategorien **Theme**
und **Farben** automatisch aus den echten Objekten aufgelistet.

## Vertrag umgesetzt

```tsx
<Surface tone="surface">
  <Txt>Vorrat</Txt>
  <Txt tone="secondary">12 Produkte</Txt>
</Surface>
```

`Surface` und `Txt` beziehen die vom `ThemeProvider` aufgelöste Palette intern
über ihre zentralen Rezepte.

## Vertrag nicht umgesetzt

```tsx
<View style={{ backgroundColor: '#FFFFFF' }}>
  <Txt color="#2FBF71">Vorrat</Txt>
</View>
```

Der Hintergrund reagiert nicht auf Dark Mode und das Grün besitzt keine
semantische Aufgabe. Im Referenz-Screen ist dieser Fall rot markiert.
