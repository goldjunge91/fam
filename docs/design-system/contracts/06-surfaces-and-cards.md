# Vertrag: Surfaces und Cards

## Zuständigkeit

Surface wählt eine semantische Hintergrundrolle; Card gruppiert zusammengehörende
Informationen; reines Layout verwendet View. Gemeinsame Flächen- und Konturrezepte
liegen in [ui.tsx](../../../src/constants/ui.tsx), ihre Werte in
[index.ts](../../../src/components/theme/index.ts). Fertige Schatten-Styles liegen
in [ui-shadow.ts](../../../src/constants/ui-shadow.ts).

Feature-Cards komponieren Inhalt, Verhalten und lokales Layout. Sie führen keine
eigene Palette oder wiederkehrenden Darstellungsrezepte ein. Dashboard-Widgets
verwenden die gemeinsamen dashboardCardSizes und bleiben innerhalb einer Ansicht
gleich hoch. Reordering- und Animationswrapper setzen keine zweite Höhe.

## Vertrag

- Surface-Töne sind page, surface, soft und accent. selected ist ein Zustand,
  kein Surface-Ton; die interaktive Komponente meldet ihn zugänglich.
- Cards verwenden die gemeinsame Foundation und ihre Flächen- und Padding-Optionen.
  Eigene shadow- oder elevation-Varianten sind nicht vorgesehen. Ein benötigter
  Schatten kommt aus uiShadowStyles. Bei GlassCard liegt er auf outerStyle, nicht
  auf dem inneren Glasinhalt. tinted verändert nur die Flächentönung.
- Gleiche Card-Varianten haben dieselbe Darstellung. Ein anderer Inhalt oder
  lokales Layout begründet keine neue Card-Variante.
- Cards werden nicht pauschal auf Listenzeilen übertragen. Dekorative Card-in-
  Card-Verschachtelung braucht eine eigene inhaltliche Gruppierung.
- Rahmen und Schatten werden nicht pauschal entfernt. Änderungen an ihrer
  sichtbaren Verwendung benötigen die Mockauswahl nach AGENTS.md.
- Antippbare Cards haben verständlichen Namen, passende Rolle und zentrales
  Pressed- und Fokusfeedback. Innere Aktionen behalten Aktivierung und Fokus;
  Haptik wird nicht doppelt ausgelöst.
- Information wird nicht allein durch Farbe oder Fläche vermittelt. Farbpaare
  folgen [Vertrag 01](./01-theme-and-colors.md), Touchflächen
  [Vertrag 07](./07-buttons-and-interaction.md).

Der Produkt-Card-Adapter ist eine nicht-interaktive Komposition aus Foundation,
Titel und optionalem Footer. Interaktion gehört in eine geeignete Press-Komponente
oder einen nativen Control im Card-Inhalt.

## Nachweis

Codeprüfung belegt Foundation und lokale Layoutgrenzen. Die Referenz zeigt
unterstützte Card-Varianten in Light und Dark. Gezielte Interaktions- und
Geräteprüfungen bewerten Haupt- und Innenaktionen, Fokusfolge, Feedback, große
Schrift und reale Inhalte.
