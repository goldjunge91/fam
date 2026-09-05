# Vertrag: NativeWind und StyleSheet

## Zweck

Die Hybridlösung teilt Verantwortung nach Art des Werts. NativeWind ist dabei
nur ein Layoutwerkzeug. `index.ts`, `ThemeProvider.tsx` und `ui.tsx` bilden
gemeinsam das Design-System.

## NativeWind

- statisches Flexbox-Layout
- feste Abstände, Ausrichtung und Positionierung
- feste Layoutgrößen

NativeWind besitzt keine semantischen Farben, Typografie, Komponenten oder
Interaktionszustände. Bestehende globale Klassen dieser Art sind
Migrationsbestand und dürfen nicht als Vorlage für neuen Code dienen.

## Semantik und lokale Styles

- Semantische Typografie, Farben, Flächen, Konturen, Schatten und Zustandsstyles:
  `src/constants/ui.tsx`
- Aufgelöste Palette: `useTheme()` aus `ThemeProvider.tsx`
- Lokales `style` oder StyleSheet: berechnete Laufzeitwerte, native
  Integrationswerte und nicht semantisches lokales Layout
- Komponenten ohne NativeWind-Interop: ihre native `style`-API, weiterhin mit
  zentralen Tokens und semantischen Rezepten

## Zentrale Verantwortliche

- `src/components/theme/index.ts`: alle gemeinsamen Design-Tokens
- `src/components/theme/ThemeProvider.tsx`: Theme-Präferenz und aktive Palette
- `src/constants/ui.tsx`: semantische UI-Primitiven, Typografierezepte,
  Farbrollenzuordnungen, Flächen, Konturen, Schatten und Zustandsstyles

`src/global.css` und `tailwind.config.js` sind technische Bestandsdateien und
keine vierte oder fünfte Design-System-Quelle. Es wird keine NativeWind-
`vars()`-Bridge als parallele Theme-Schicht eingeführt.

## Vertrag umgesetzt

```tsx
<Surface
  tone="soft"
  className="flex-row items-center"
  style={{ gap: space.md }}
/>
```

## Vertrag nicht umgesetzt

```tsx
<View className={`bg-[${colors.background}] ${active ? color : other}`} />
```

Dynamisch zusammengesetzte Klassen sind für den Compiler nicht zuverlässig
auffindbar und würden Theme-Semantik erneut NativeWind überlassen. Der
Referenz-Screen **Hybrid** zeigt die verbindliche Aufgabenteilung und
`withAlpha()` für eine transparente Ableitung.
