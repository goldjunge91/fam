# Vertrag: Surfaces und Cards

## Zweck und Zuständigkeit

`Surface` wählt eine semantische Hintergrundrolle. `Card` gruppiert inhaltlich
zusammengehörende Informationen. Reines Layout verwendet einen `View`.
Gemeinsame Hintergrund-, Kontur-, Radius- und Schattenrezepte gehören in `ui.tsx`
und beziehen ihre Werte aus `index.ts` sowie dem aktiven ThemeProvider.

Höhere Cards dürfen Inhalt, Verhalten und lokales Layout komponieren. Sie besitzen
keine unabhängige Flächenpalette oder selbst zusammengesetzte semantische Styles.

## Surface- und Card-Vertrag

- Surface-Töne bleiben `page`, `surface`, `soft` und `accent`.
- `selected` ist kein zusätzlicher Surface-Ton. Interaktive Komponenten wenden
  das zentrale Auswahlrezept an und melden ihren Zustand zugänglich.
- Produktcards verwenden die gemeinsame Foundation. Bestehende zentrale Optionen
  für Padding, weiche Fläche oder Elevation können über Adapter angewendet werden,
  soweit deren öffentliche API sie unterstützt. Neue Props werden nicht erfunden,
  nur um ein Dokumentationsbeispiel ausführbar erscheinen zu lassen.
- Gleiche Varianten haben dieselbe Darstellung. Unterschiedliche Inhalte oder
  lokale Anordnung erfordern keine neue Card-Definition.
- Der Card-Standard wird nicht pauschal auf jede Listenzeile übertragen. Keine
  dekorative Card-in-Card-Verschachtelung ohne zusätzliche inhaltliche Gruppierung.
- Rahmen und Schatten werden nicht pauschal entfernt. Änderungen ihrer konkreten
  Verwendung sind sichtbare Gestaltungsentscheidungen und benötigen passende Mocks.

## Antippbare Cards

Eine antippbare Card hat verständlichen Namen, passende Rolle und zentrales
Pressed-/Fokusfeedback. Ihr tatsächlicher Touchbereich erfüllt den
[Interaktionsvertrag](./07-buttons-and-interaction.md). Enthält sie weitere
Aktionen, dürfen deren Aktivierung und Screenreader-Fokus nicht von einem
übergeordneten Pressable verschluckt werden. Keine doppelte Haptik.

Information darf nicht ausschließlich durch Fläche oder Farbe vermittelt werden.
Die Text-/Flächenkombination folgt [Vertrag 01](./01-theme-and-colors.md).

## Beispiel der vorgesehenen Verwendung

```tsx
import { Card } from '@/components/ui/card';
import { Txt } from '@/constants/ui';

<Card title="Vorrat">
  <Txt tone="secondary">12 Produkte, 2 laufen bald ab</Txt>
</Card>
```

Ein Feature-`View` mit eigener Kombination aus weißer Fläche, Radius, Border und
Schatten ist keine zulässige Card-Implementierung. Ein `View` für die interne
Zeilenanordnung innerhalb der gemeinsamen Card ist dagegen richtig.

## Nachweis

Codeprüfung belegt die gemeinsame Foundation und die Trennung von lokalem Layout.
Die Referenz zeigt Surface-Töne und tatsächlich unterstützte Card-Varianten in
Light/Dark. Interaktionstests und native Prüfung belegen Hauptaktion, innere
Aktionen, Screenreader-Reihenfolge und Feedback. Dichte und große Schrift werden
mit realen Inhalten beurteilt.
