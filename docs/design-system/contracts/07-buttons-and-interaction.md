# Vertrag: Buttons und Interaktion

## Zweck

Buttons machen Priorität, Gefahr, Zustand und Berührung konsistent. Produktcode
verwendet die Exports aus `src/components/ui/buttons/`.

Die Button-Implementierung darf keine eigene Designquelle bilden. Rohe Palette,
Spacing, Radius und Tiefe kommen aus `src/components/theme/index.ts`;
`ThemeProvider.tsx` löst die aktive Palette auf. Button-Typografie, semantische
Farbzuordnungen, Animationstiming und pressed-, loading- und disabled-
Darstellungen werden in `src/constants/ui.tsx` definiert. Komponenten unter
`src/components/ui/buttons/` wenden diese Definitionen an und ergänzen Verhalten
oder Komposition. NativeWind darf am Aufrufer nur Layout beisteuern.

## Varianten und Zustände

- `primary`, `secondary`, `danger`, `accent`, `ghost`, `link`
- `default`, `large`, `compact`
- `loading`, `disabled`, gedrückt
- 3D-Tiefe für gefüllte Varianten
- 4pt Tiefe und 4pt Druckweg für `primary`, `danger` und `accent`
- eigene deckende Fam-Tiefenfarbe für jede gefüllte Variante
- keine zusätzlichen Press-Overlays oder zeitgesteuerten Animationssequenzen
- `secondary` verwendet die weiche Mauve-Fläche ohne zusätzliche Kontur
- Haptik über `src/lib/haptics.ts`

Die Implementierung besteht aus zwei nativen Ebenen. Der äußere `View` trägt
die deckende Tiefenfarbe und reserviert unten `BUTTON_DEPTH`. Darauf liegt die
eigentliche Buttonfläche in einem `Animated.View`. `onPressIn` bewegt nur diese
Vorderseite in 60ms um `BUTTON_DEPTH` nach unten. `onPressOut` federt sie auf
Position `0` zurück.

## Vertrag umgesetzt

```tsx
<Button label="Speichern" loading={isSaving} onPress={save} />
```

## Vertrag nicht umgesetzt

```tsx
<Pressable style={{ height: 37, backgroundColor: '#2FBF71' }}>
  <Text style={{ color: '#fff' }}>Speichern</Text>
</Pressable>
```

Das Gegenbeispiel umgeht Theme, Mindestgröße, 3D-Tiefe, Loading, Disabled und
Haptik. Der Referenz-Screen **Bedienung** rendert die echten Varianten.
