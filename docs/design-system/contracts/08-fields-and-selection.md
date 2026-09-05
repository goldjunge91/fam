# Vertrag: Felder und Auswahl

## Zweck

Eingaben und Auswahlzustände verwenden wiedererkennbare Komponenten und zeigen
ihren Zustand nicht nur über Farbe.

## Komponenten

- `Field`
- `Pill`
- `Badge`
- `SegmentedControl`
- `QuantityStepper`
- domänenspezifische Selects auf denselben Grundregeln

`Field` zeigt Fokus über Akzent-Border, Akzent-Label und Cursor. Einzeilige
Felder verwenden standardmäßig die Return-Aktion `done` und schließen den Fokus
beim Absenden. Screens mit Eingaben stellen genau eine `KeyboardToolbar` bereit,
damit auch Tastaturen ohne eigene Return-Taste eine sichtbare Fertig-Aktion
besitzen.

## Fokusvertrag

| Zustand | Label | Border | Cursor und Auswahl |
| --- | --- | --- | --- |
| Nicht fokussiert | `colors.text` | 1,5pt `colors.border` | `colors.accent` |
| Fokussiert | `colors.accent` | 2pt `colors.accent` | `colors.accent` |

Der Fokus wird damit nicht nur durch den blinkenden Cursor angezeigt. Caller
dürfen weiterhin `onFocus` und `onBlur` verwenden; `Field` führt diese Handler
nach seiner internen Zustandsaktualisierung aus.

## Vertrag umgesetzt

```tsx
<Field label="Produktname" placeholder="Zum Beispiel Hafermilch" />
<Pill label="Bald fällig" selected={selected} onPress={toggle} />
```

## Vertrag nicht umgesetzt

```tsx
<TextInput placeholder="Produkt" style={{ color: '#222' }} />
<View style={{ backgroundColor: selected ? 'green' : 'white' }} />
```

Das Feld besitzt keine Theme-Placeholderfarbe oder gemeinsame Form. Die
Auswahl ist ohne Text oder Symbol nicht verständlich. Sichtbar im Screen
**Bedienung**.
