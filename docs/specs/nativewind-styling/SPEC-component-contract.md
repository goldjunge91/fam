# Spec: `core-ui-contract`

## Objective

Die bereits eingefügte `ui.tsx` wird zur fam-kompatiblen Quelle für wiederverwendbare UI-Primitiven. Die vorhandene Komponentenbreite, Props und das Verhalten der Referenz bleiben erhalten. Ersetzt werden nur Dinge, für die fam bereits eine eigene, passende Quelle besitzt oder die im Projekt nachweislich nicht funktionieren: reale Imports, vorhandene Fam-Tokens, Haptics und problematische Typen.

## Komponentenübersicht

| Komponente | Zweck | Semantische Styles | Zustände |
| --- | --- | --- | --- |
| `Txt` | Text und Typografie | Variant, Tone, Weight, Alignment | normal, muted, disabled über Caller |
| `Surface` | generischer thematischer Container, Ersatz für `ThemedView` | page, surface, soft, selected, accent | normal |
| `Card` | Karten und Listencontainer | surface, border, radius, elevation, padding | normal, soft |
| `Row` | horizontales Layout | Flex-Richtung, Alignment, Gap | wrap |
| `Spacer` | vertikaler Abstand | `space` | normal |
| `Divider` | Trennlinie | `border` | normal |
| `Press` | pressbare Basis mit optionalem Feedback | Layout, Press-Animation | disabled, pressed |
| `Button` | primäre Aktionen | variant, size, fill, text tone, depth | normal, pressed, disabled, loading |
| `IconButton` | kompakte Icon-Aktion | Fam-Icon, surface, radius | disabled, pressed |
| `Badge` / `Pill` | Status und Filter | Fam-Ton, border, radius | selected, disabled, solid |
| `SegmentedControl` | Auswahl zwischen wenigen Optionen | selected surface, border, text tone | active, pressed |
| `Field` | TextInput mit Label | surface, border, placeholder, text | focused, disabled, error via Caller |
| `EmptyState` | leerer Zustand | Typografie, spacing | action optional |
| `SectionHeading` | Abschnittstitel mit Aktion | heading, label, accent | action optional |

## `Surface` statt `ThemedView`

`ThemedView` war generisch, ignorierte aber `lightColor` und `darkColor`. `Surface` übernimmt nur semantische Töne:

```tsx
<Surface tone="page" className="flex-1">
  <Txt variant="headingSmall">Bestand</Txt>
</Surface>
```

Freie Light-/Dark-Farbprops werden nicht weitergeführt. Für einen echten Sonderfall wird `style` explizit verwendet.

## Button-Vertrag

```ts
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg';
```

- `primary`, `danger` und `accent` sind gefüllt und verwenden Fam-Akzent-/Status-Tokens.
- `secondary` ist eine kontrastreiche Surface-/Border-Variante.
- `ghost` ist transparent oder soft, ohne versteckte Fremdfarbe.
- `loading` deaktiviert die Aktion, zeigt einen Spinner und löst keinen zweiten Haptic aus.
- `disabled` reduziert Kontrast und verhindert Press-Feedback.
- `style` darf Layout überschreiben. Button-Farbvarianten werden nicht durch ein konkurrierendes `className` unklar gemacht.
- Touch-Ziele bleiben auf mobilen Plattformen ausreichend groß; konkrete Maße stammen aus `ButtonSize` oder den bestehenden Fam-Control-Tokens.
- `accessibilityRole="button"`, Titel und disabled/loading-Status werden zugänglich abgebildet.

Die 3D-Tiefe und Press-Animation aus der Referenz bleiben Bestandteil des UI-Vertrags. Eine spätere visuelle Entscheidung über diese Details erfolgt erst nach zwei repräsentativen Screen-Mocks. Stabilität und lesbarer Zustand haben Vorrang vor einer zusätzlichen Dekorationsschicht.

## Card-Vertrag

- Default-Hintergrund ist `backgroundElement`.
- `soft` verwendet `backgroundSelected` oder einen dokumentierten Fam-Soft-Ton.
- Border und Radius kommen aus Tokens.
- `elevation="none"` deaktiviert Schatten deterministisch.
- Padding ist über `padded` und Tokenwerte steuerbar.
- Caller-Layout-Style bleibt möglich, aber Hintergrund und Border werden nicht zufällig aus einer Tailwind-Klasse bezogen.

## Field-Vertrag

- Label verwendet `Txt variant="label"`.
- Placeholder, Text und Border kommen aus dem aktiven Theme.
- `TextInput` erhält ein echtes `style`, weil dynamische Farben und native Eingabeeigenschaften zuverlässig sein müssen.
- Focus- und Error-Zustände dürfen über typisierte Props oder einen klaren lokalen Style ergänzt werden.

## Haptics

`Press` und `Button` importieren die Intent-Funktionen aus `src/lib/haptics.ts`. Die neue UI-Datei enthält keine eigene Expo-Haptics-Implementierung. Haptics sind best effort und dürfen eine Aktion nie blockieren.

## Acceptance criteria

- [ ] `ui.tsx` nutzt reale `@/...`-Imports und kompiliert ohne undefinierte Symbole.
- [ ] Neue und leicht ersetzbare `any`-Typen in `ui.tsx` sind durch passende React-Native-Typen ersetzt.
- [ ] Ein verbleibendes `any` ist nur erlaubt, wenn die Bibliotheks- oder React-Native-Typen keine sichere Alternative bieten, lokal begrenzt und dokumentiert ist.
- [ ] Bestehende Fam-Tokens werden überall dort verwendet, wo sie ein direktes Gegenstück zu einem Referenzwert darstellen.
- [ ] ui-Komponenten, Props und Verhalten bleiben erhalten, wenn kein Fam-Gegenstück existiert. ui-only Werte werden nicht als globale Palette oder neue Theme-Quelle exportiert.
- [ ] `Surface` deckt alle bisherigen `ThemedView`-Anwendungsfälle ab.
- [ ] Button-Zustände sind mit fokussierten Tests abgesichert.
- [ ] `Press`, `Button` und `IconButton` lösen Haptics nur bei tatsächlich erlaubten Aktionen aus.
- [ ] Die bisherige `ThemedText`-/`ThemedView`-API ist nach Migration nicht mehr im Production-Code importiert.
