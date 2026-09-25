# Vertrag: Surfaces und Cards

## Zweck und Zuständigkeit

`Surface` wählt eine semantische Hintergrundrolle. `Card` gruppiert inhaltlich
zusammengehörende Informationen. Reines Layout verwendet einen `View`.
Gemeinsame Hintergrund-, Kontur- und Radius-Styles gehören in `ui.tsx` und
beziehen ihre Werte aus `index.ts` sowie dem aktiven ThemeProvider. Fertige
Schatten-Styles exportiert das zum selben UI-Owner gehörende
`src/constants/ui-shadow.ts`.

Höhere Cards dürfen Inhalt, Verhalten und lokales Layout komponieren. Sie besitzen
keine unabhängige Flächenpalette oder selbst zusammengesetzte semantische Styles.
Dashboard-Widgets verwenden für ihre beiden Ansichten die zentralen
`dashboardCardSizes`-Tokens aus dem Theme-Owner: klein 138pt, groß 176pt, jeweils
mit dem gemeinsamen `space.lg`-Innenabstand. Die Card-Hülle verwendet diese
Tokens als feste Höhen, damit alle Widgets derselben Ansicht exakt ausgerichtet
bleiben. Wrapper für Reordering und Animation verwenden keine zweite feste
Höhe. Der Inhalt darf diese Standardmaße nicht durch eigene Größenkonstanten
ersetzen.
Die Dashboard-Widgets verwenden dafür `DashboardCardShell` als gemeinsame
äußere Foundation; Feature-Komponenten liefern nur ihr inneres Layout und den
Inhalt.

## Surface- und Card-Vertrag

- Surface-Töne bleiben `page`, `surface`, `soft` und `accent`.
- `selected` ist kein zusätzlicher Surface-Ton. Interaktive Komponenten wenden
  das zentrale Auswahlrezept an und melden ihren Zustand zugänglich.
- Produktcards verwenden die gemeinsame Foundation und deren vorhandene Optionen
  für Padding und Fläche. Cards führen keine Fam-eigene `shadow`- oder
  `elevation`-Prop zur Auswahl eines Schattens ein. Falls eine Card einen
  Schatten benötigt, wird ein fertiger Style aus `uiShadowStyles` über die
  vorhandene `style`-API angewendet. Bei `GlassCard` wird der Style über
  `outerStyle` auf den äußeren Wrapper gelegt, nicht auf den inneren
  Glasinhalt. `tinted` verändert ausschließlich die Flächentönung.
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

Der aktuelle Produkt-`Card`-Adapter ist eine nicht-interaktive Komposition aus
Foundation, Titel und optionalem Footer. Echte Interaktion wird durch eine
geeignete bestehende Press-Komponente oder einen nativen Control im Card-Inhalt
modelliert.

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
