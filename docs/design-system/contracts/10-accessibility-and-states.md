# Vertrag: Accessibility und Zustände

## Zweck

Interaktion bleibt für Touch, Screenreader, größere Schrift und reduzierte
Bewegung verständlich.

## Anforderungen

- verständliche `accessibilityLabel`
- passende `accessibilityRole`
- `accessibilityState` für selected, disabled, busy und expanded
- mindestens 44 Punkte Touchziel für normale Aktionen
- Status zusätzlich durch Text, Symbol oder Form ausdrücken
- Loading blockiert Doppelaktionen
- reduzierte Bewegung respektieren

## Vertrag umgesetzt

```tsx
<Pressable
  accessibilityRole="button"
  accessibilityLabel="Eintrag hinzufügen"
  accessibilityState={{ disabled }}
  disabled={disabled}>
  <Txt>Eintrag hinzufügen</Txt>
</Pressable>
```

## Vertrag nicht umgesetzt

```tsx
<Pressable style={{ width: 20, height: 20 }}>
  <Text style={{ color: 'green' }}>+</Text>
</Pressable>
```

Das Ziel ist zu klein, besitzt keine Rolle und sein Zustand ist nur farblich
erkennbar. Die Screens **Zustände** und **Feedback** zeigen die Gegenüberstellung.

