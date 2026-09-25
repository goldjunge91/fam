# Vertrag: Radien, Schatten und Verläufe

## Zweck und Zuständigkeit

Form und Tiefe bleiben über Screens konsistent. `radius`, `borderWidth`, `shadow`,
`BUTTON_DEPTH`, `Gradients` und `GradientSpec` stammen aus `index.ts`. Gemeinsame
fertige Schatten-Styles werden als `uiShadowStyles` in
`src/constants/ui-shadow.ts` exportiert. Das Modul gehört zum UI-Owner neben
`ui.tsx` und bildet keinen zusätzlichen Owner.
`Fonts` gehört zum [Typografievertrag](./02-typography.md).

## Form und Tiefe

- Radien wählen die zentralen Werte von `radius.sm` bis `radius.pill`.
  Wiederkehrende neue Formen brauchen eine zentrale Entscheidung.
- Konturstärken wählen die zentralen Werte `borderWidth.base` (1,5 Punkte) für
  normale Konturen und `borderWidth.strong` (2 Punkte) für betonte Konturen.
  Features legen keine eigenen wiederkehrenden Konturstärken an.
- Gemeinsame Schatten-Styles verwenden `boxShadow` und die aktive Palette aus dem
  ThemeProvider. `shadow.sm` bis `shadow.prominent` liefern ausschließlich
  zentrale Geometrie und Opazität; `boxShadowValue(...)` setzt den aktiven
  Theme-Farbwert ein. Die Zuordnung von Rolle, Farbe und Richtung liegt in
  `uiShadowStyles`, nicht in Feature-Dateien. Für gerichtete Flächen wie Sheets
  oder Drawer dreht der Richtungswert dieselbe vorhandene Stufe; dafür werden
  keine neuen Schatten-Tokens angelegt.
- Die alten React-Native-Eigenschaften `shadowColor`, `shadowOffset`,
  `shadowOpacity`, `shadowRadius` und das native React-Native-`elevation` gehören
  nicht zu den visuellen Schatten-Styles. Die bestehende öffentliche
  `Card.elevation`-Prop bleibt als semantische Auswahl bestehen und wird intern
  auf `uiShadowStyles` abgebildet.
- Schattenfarben sind ausschließlich für Schatten vorgesehen, nicht für
  Beschriftungen oder Statusicons.
- Gefüllte Buttons behalten 4 Punkte sichtbare Tiefe und 4 Punkte Druckweg.
  Aufbau, Flat-Ausnahme und Reduced Motion regelt
  [Vertrag 07](./07-buttons-and-interaction.md).
- Ein lokaler Margin-Wert simuliert keine Buttontiefe. Features bauen keine
  zusätzliche Schatten-/Border-/Radiuskombination als eigene Card-Variante.
- Native Plattformdarstellung darf technisch abweichen; Gruppierung und
  Hierarchie müssen in Light/Dark erhalten bleiben. Schatten werden nicht
  pauschal abgeschafft oder jedem Element hinzugefügt.

## Gemeinsame Schatten-Styles

`src/constants/ui-shadow.ts` exportiert `uiShadowStyles`. Es gibt zehn sichtbare
Styles und einen Reset; gleiche Geometrien dürfen mehrere Rollen abdecken.
`down`, `up` und `right` bezeichnen die Richtung des Versatzes. Sie sparen keine
Seite des Schattens aus. `prominentCard` ist gleichmäßig zentriert.

| Style | Geometrie und Farbe | Einsatz |
| --- | --- | --- |
| `cardBottom` | `shadow.sm`, `shadowCard`, down | Normale Card und GlassCard; `Card.elevation="sm"` sowie Standardwert |
| `raisedCardBottom` | `shadow.md`, `shadowCard`, down | Erhöhte Card; `Card.elevation="md"` |
| `modalBottom` | `shadow.lg`, `shadowCard`, down | Dialog-/Overlay-Flächen und `Card.elevation="lg"` |
| `prominentCard` | `shadow.prominent`, `shadowCard`, zentriert | Dashboard- und Inventory-Summary-Cards |
| `floatingControlBottom` | `shadow.md`, `shadowCard`, down | Frei liegende Controls, Speed-Dial und Jiggle-Badges |
| `floatingPanelBottom` | `shadow.lg`, `shadowSheet`, down | Dropdowns und schwebende Auswahlpanels |
| `bottomSheetTop` | `shadow.lg`, `shadowSheet`, up | Von unten kommende Sheets |
| `leftDrawerRight` | `shadow.lg`, `shadowSheet`, right | Linker Navigations-Drawer |
| `hotspotBottom` | X=0, Y=1, Blur=2, Opazität=0.20, `shadowCard` | 18×18-Broschüren-Hotspot; einzige dokumentierte enge Geometrie |
| `accentNoteBottomRight` | X=4, Y=5, Blur=0, Opazität=0.18, `accent` | Harter Illustrationsschatten von `kitchenNoteSheet` |
| `none` | `boxShadow: "none"` | Expliziter Reset eines geerbten Schattens |

`Card.elevation` bleibt unverändert: `sm` und der Standard verwenden
`cardBottom`, `md` verwendet `raisedCardBottom`, `lg` verwendet `modalBottom`.
`none` fügt keinen Standardschatten hinzu und lässt einen ausdrücklich in
`style` gesetzten Schatten bestehen. `GlassCard.shadow` ist erforderlich und
wählt `card`, `prominent` oder `floatingControl`; `tinted` ändert ausschließlich
die Flächentönung. `DashboardCardShell` verlangt ebenfalls die Auswahl und
reicht sie unverändert weiter. Alle Dashboard-Aufrufe wählen `prominent`
explizit; Rahmen und Overflow gehören zur Shell, nicht zur Schattenauswahl.

Die beiden Sondergeometrien sind ausschließlich in `ui-shadow.ts` definiert.
Die Kommentare dort benennen den jeweiligen Einsatzort und den Grund. Andere
Feature-Dateien wenden exportierte Styles über Style-Arrays an und fügen keine
lokalen Schattenwerte hinzu.

## Verläufe und native Darstellung

Verläufe werden als zentrale Specs ausgewählt. Feature-Code erfindet keine
Hex-Arrays. Aufrufer dürfen native Integrationswerte über die erforderliche
Style-/Prop-API weiterreichen; die semantische Farbwahl bleibt zentral.

Text und notwendige Statusmerkmale müssen auch an der ungünstigsten relevanten
Stelle eines Verlaufs lesbar sein. Transparente Flächen werden mit dem tatsächlichen
Untergrund geprüft. Eine definierte Textfläche ist zulässig, wenn der Verlauf
sonst keinen sicheren Kontrast bietet. Es gelten die Werte aus
[Vertrag 01](./01-theme-and-colors.md).

## Beispiel der vorgesehenen Verwendung

```tsx
import { Card } from '@/components/ui/card';
import { Button, Txt } from '@/constants/ui';

<Card title="Vorrat">
  <Txt tone="secondary">12 Produkte</Txt>
  <Button title="Speichern" onPress={save} />
</Card>
```

Die Card und der Button wenden ihre gemeinsamen Styles intern an. Das frühere
positive Beispiel `<View style={{ borderRadius: radius.md, ...shadow.sm }} />`
ist als Empfehlung für Feature-Code nicht zulässig. Ein solcher Rohwertvergleich
darf nur als eindeutig beschriftete Tokenvisualisierung der Entwicklerreferenz
oder an einer konkret begründeten nativen Grenze vorkommen.

## Nachweis

Die Referenz zeigt Radien, Schattenstufen und Verläufe anhand realer zentraler
Werte. Produktkomponenten belegen die Anwendung der gemeinsamen Styles.
iOS-/Android-Prüfung bestätigt Darstellung und Druckweg; Light/Dark-Prüfung
bestätigt Lesbarkeit und Gruppierung. Tokenvisualisierung gilt nicht als Nachweis
für die korrekte Integration in Produktkomponenten.
