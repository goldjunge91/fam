# Vertrag: Radien, Schatten und Verläufe

## Zweck

Form und Tiefe bleiben über Screens konsistent. Schatten verwenden den aktiven
Theme-Farbton, gefüllte Buttons behalten ihre definierte 3D-Tiefe.

## Zentrale Variablen

- `radius.sm` bis `radius.pill`
- `shadow.sm`, `shadow.md`, `shadow.lg`
- `BUTTON_DEPTH`
- `Gradients` und `GradientSpec`
- `Fonts`

Der Referenz-Screen **Tokens** rendert jede Kategorie mit ihrem echten Wert.

## Vertrag umgesetzt

```tsx
<View style={{ borderRadius: radius.md, ...shadow.sm }} />
<Button label="Speichern" onPress={save} />
```

## Vertrag nicht umgesetzt

```tsx
<View style={{ borderRadius: 37, elevation: 13 }} />
<Pressable style={{ marginBottom: 6 }}>Speichern</Pressable>
```

Lokale Fantasiewerte erzeugen eine zweite Formensprache. 3D-Tiefe wird von der
Button-Komponente implementiert, nicht als Abstand am Aufrufer.
