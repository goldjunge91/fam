# Spec: `core-ui-contract`

## Status

Abgeschlossen und historisch. Der aktuelle Komponentenvertrag steht unter
`docs/design-system/contracts/`. Bei Abweichungen gelten die Verträge und die
tatsächlichen APIs in `src/constants/ui.tsx` und `src/components/ui/`.

## Objective

Die eingefügte Referenz wurde als `src/constants/ui.tsx` zur fam-kompatiblen
Quelle für wiederverwendbare UI-Primitiven. Reale Imports, vorhandene
Fam-Tokens, Haptics und problematische Typen wurden an das Projekt angepasst.

## Komponentenübersicht

| Komponente | Zweck | Semantische Styles | Zustände |
| --- | --- | --- | --- |
| `Txt` | Text und Typografie | Variant, Tone, Weight, Alignment | normal, muted, disabled über Caller |
| `Surface` | generischer thematischer Container, Ersatz für `ThemedView` | page, surface, soft, accent | normal |
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
  <Txt variant="heading">Bestand</Txt>
</Surface>
```

Freie Light-/Dark-Farbprops werden nicht weitergeführt. Für einen echten Sonderfall wird `style` explizit verwendet.

## Button-Vertrag

```ts
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'link' | 'ghost' | 'accent';
type ButtonSize = 'default' | 'large' | 'compact';
```

- `primary`, `danger` und `accent` sind gefüllt und verwenden Fam-Akzent-/Status-Tokens.
- `secondary` verwendet die weiche Mauve-Fläche ohne zusätzliche Kontur.
- `ghost` ist transparent und besitzt keine versteckte Fremdfarbe.
- `loading` deaktiviert die Aktion, zeigt einen Spinner und löst keinen zweiten Haptic aus.
- `disabled` reduziert Kontrast und verhindert Press-Feedback.
- `style` darf Layout überschreiben. Button-Farbvarianten werden nicht durch ein konkurrierendes `className` unklar gemacht.
- Touch-Ziele bleiben auf mobilen Plattformen ausreichend groß; konkrete Maße stammen aus `ButtonSize` oder den bestehenden Fam-Control-Tokens.
- `accessibilityRole="button"`, Beschriftung beziehungsweise `label` und
  disabled/loading-Status werden zugänglich abgebildet.

Das ist die feature-facing API aus `src/components/ui/buttons/`. Der
Low-Level-Button in `src/constants/ui.tsx` behält intern seine bestehende
`title`-/`sm`-/`md`-/`lg`-Signatur, ist aber keine zweite Designquelle. Beide
Implementierungen beziehen Semantik und Werte aus denselben drei zentralen
UI-Quellen und werden innerhalb eines Screens nicht gemischt.

Die 3D-Tiefe und Press-Animation bleiben Bestandteil des UI-Vertrags. Gefüllte
Varianten verwenden eine deckende Fam-Tiefenfarbe und bewegen ihre Vorderseite
beim Drücken um die vollständigen `BUTTON_DEPTH` von 4pt. Beim Loslassen federt
die Vorderseite direkt zurück. Zusätzliche Press-Overlays und künstliche
Mindestdruckzeiten gehören nicht zum Vertrag.

## Card-Vertrag

- Default-Hintergrund ist `backgroundElement`.
- `soft` verwendet `backgroundSoft`.
- Border und Radius kommen aus Tokens.
- `elevation="none"` deaktiviert Schatten deterministisch.
- Padding ist über `padded` und Tokenwerte steuerbar.
- Caller-Layout-Style bleibt möglich, aber Hintergrund und Border werden nicht zufällig aus einer Tailwind-Klasse bezogen.

## Field-Vertrag

- Label verwendet `Txt variant="label"`.
- Placeholder, Text und Border kommen aus dem aktiven Theme.
- `TextInput` erhält ein echtes `style`, weil dynamische Farben und native Eingabeeigenschaften zuverlässig sein müssen.
- Focus- und Error-Darstellungen werden zentral in `src/constants/ui.tsx`
  definiert und über typisierte Props aktiviert; der Aufrufer erfindet keinen
  lokalen Zustandsstil.

## Haptics

`Press` und `Button` importieren die Intent-Funktionen aus `src/lib/haptics.ts`. Die neue UI-Datei enthält keine eigene Expo-Haptics-Implementierung. Haptics sind best effort und dürfen eine Aktion nie blockieren.

## Acceptance criteria

- [x] `src/constants/ui.tsx` nutzt reale `@/...`-Imports und kompiliert ohne
  undefinierte Symbole.
- [x] Neue und leicht ersetzbare `any`-Typen in `src/constants/ui.tsx` sind
  durch passende React-Native-Typen ersetzt.
- [x] Ein verbleibendes `any` ist nur erlaubt, wenn die Bibliotheks- oder React-Native-Typen keine sichere Alternative bieten, lokal begrenzt und dokumentiert ist.
- [x] Bestehende Fam-Tokens werden überall dort verwendet, wo sie ein direktes Gegenstück zu einem Referenzwert darstellen.
- [x] ui-Komponenten, Props und Verhalten bleiben erhalten, wenn kein Fam-Gegenstück existiert. ui-only Werte werden nicht als globale Palette oder neue Theme-Quelle exportiert.
- [x] `Surface` deckt alle bisherigen `ThemedView`-Anwendungsfälle ab.
- [x] Button-Zustände sind mit fokussierten Tests abgesichert.
- [x] `Press`, `Button` und `IconButton` lösen Haptics nur bei tatsächlich erlaubten Aktionen aus.
- [x] Die bisherige `ThemedText`-/`ThemedView`-API ist nach Migration nicht mehr im Production-Code importiert.
