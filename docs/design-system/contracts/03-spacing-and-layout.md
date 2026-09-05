# Vertrag: Spacing und Layout

## Zweck

Abstände bilden eine kleine, wiederholbare Skala. Statisches Flexbox-Layout
kann über NativeWind beschrieben werden; wiederkehrende Maße stammen aus
`space` in `src/components/theme/index.ts`.

## Zentrale Variablen

- `space.xs` bis `space.xxxl`
- `SCREEN_W`, `IS_TABLET`, `CONTENT_MAX_WIDTH`
- responsive Skalierung der Werte in `index.ts`

Der Referenz-Screen **Tokens** zeigt jeden Abstand maßstabsgetreu sowie die
aktuell aufgelösten Gerätemaße.

## Vertrag umgesetzt

```tsx
<View className="flex-row items-center" style={{ gap: space.md }}>
  {children}
</View>
```

NativeWind beschreibt hier nur die statische Flex-Struktur. Der gemeinsame
Abstand bleibt ein Token und wird nicht als zweite Skala in
`tailwind.config.js` gepflegt.

## Vertrag nicht umgesetzt

```tsx
<View style={{ gap: 11, paddingHorizontal: 19 }}>
  {children}
</View>
```

Zufällige Maße erzeugen visuelle Drift. Ein einmaliger, fachlich begründeter
Wert ist erlaubt; ein wiederkehrender Wert wird zentralisiert.
