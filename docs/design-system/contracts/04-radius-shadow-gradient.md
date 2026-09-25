# Vertrag: Radien, Schatten und Verläufe

## Zweck und Zuständigkeit

Form und Tiefe bleiben über Screens konsistent. `radius`, `borderWidth`,
`BUTTON_DEPTH`, `Gradients` und `GradientSpec` stammen aus `index.ts`. Die
Theme-Paletten behalten `shadowCard` und `shadowSheet`; `withAlpha` bleibt eine
allgemeine Theme-Hilfsfunktion. Schattengeometrien und ihre interne Umwandlung
in `boxShadow` liegen in `src/constants/ui-shadow.ts`. Das Modul gehört zum
UI-Owner neben `ui.tsx` und exportiert ausschließlich fertige `uiShadowStyles`.
`Fonts` gehört zum [Typografievertrag](./02-typography.md).

## Form und Tiefe

- Die Radien aus `index.ts` sind `micro` (2), `s` (4), `xs` (8), `sm` (12),
  `md` (16), `lg` (20), `xl` (26), `xxl` (32), `famLarge` (28) und `pill`
  (999). Wiederkehrende neue Formen brauchen eine zentrale Entscheidung.
- Nicht kapselartige Radien werden auf nativen Flächen mit
  `borderCurve: 'continuous'` kombiniert. Die nicht-kapselartigen Radien in
  `ui.tsx` setzen diese Kurve; pill- und kreisförmige Geometrien behalten ihre
  jeweilige Rundung. `floatingActionButtonStyles.face` behält die explizite
  Kurve ebenfalls bei.
- Konturstärken wählen die zentralen Werte `borderWidth.base` (1,5 Punkte) für
  normale Konturen und `borderWidth.strong` (2 Punkte) für betonte Konturen.
  Features legen keine eigenen wiederkehrenden Konturstärken an.
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

## Schatten: RN-`boxShadow`, keine Schatten-Props

`src/constants/ui-shadow.ts` enthält die internen Geometrien und Opazitäten
sowie den internen Formatter `boxShadowValue()`. Das Modul exportiert
ausschließlich fertige `uiShadowStyles`; einzelne Geometrien sind keine
öffentliche Komponenten-API. Fam-Komponenten erhalten keine eigene Prop namens
`shadow` oder `elevation` zur Schattenauswahl. Ein benötigter Schatten wird als
fertiger `uiShadowStyles.*`-Style über die vorhandene allgemeine `style`-API
angewendet. Dafür wird React Natives `boxShadow`-Style verwendet.

Die Vorzeichen der Geometrie bestimmen die Richtung: positives X nach rechts,
negatives X nach links, positives Y nach unten, negatives Y nach oben. Mehrere
Schattenebenen stehen als kommaseparierte `boxShadow`-String-Layer. Sheet- und
Drawer-Richtungen entstehen durch signierte X-/Y-Offsets derselben vorhandenen
Geometrien; dafür kommen keine Richtungs-Props oder zusätzlichen Tokens hinzu.

Bei `GlassCard` liegt ein Schatten auf dem äußeren Wrapper über dessen
vorhandenem `outerStyle`, nicht auf dem inneren Glasinhalt. `tinted` steuert
ausschließlich die Flächentönung. `DashboardCardShell` wendet seine zentrale
Dashboard-Schattenstufe selbst an; Aufrufer wählen sie nicht über eine
Schatten-Prop.

| Style | Geometrie und Farbe | Einsatz |
| --- | --- | --- |
| `cardBottom` | `shadow.sm`: X=0, Y=2, Blur=6, Opazität=0.08, `shadowCard` | Kartenflächen, wenn der Style über `style` angewendet wird |
| `raisedCardBottom` | `shadow.md`: X=0, Y=6, Blur=14, Opazität=0.10, `shadowCard` | Erhöhte Kartenflächen |
| `modalBottom` | `shadow.lg`: X=0, Y=12, Blur=24, Opazität=0.14, `shadowCard` | Dialog-/Overlay-Flächen |
| `prominentCard` | `shadow.prominent`: X=0, Y=0, Blur=18, Opazität=0.70, `shadowCard` | Dashboard- und Inventory-Summary-Cards |
| `floatingControlBottom` | `shadow.md`: X=0, Y=6, Blur=14, Opazität=0.10, `shadowCard` | Frei liegende Controls, Speed-Dial und Jiggle-Badges |
| `floatingPanelBottom` | `shadow.lg`: X=0, Y=12, Blur=24, Opazität=0.14, `shadowSheet` | Dropdowns und schwebende Auswahlpanels |
| `bottomSheetTop` | `shadow.lg`: X=0, Y=-12, Blur=24, Opazität=0.14, `shadowSheet` | Von unten kommende Sheets |
| `leftDrawerRight` | `shadow.lg`: X=12, Y=0, Blur=24, Opazität=0.14, `shadowSheet` | Linker Navigations-Drawer |
| `hotspotBottom` | X=0, Y=1, Blur=2, Opazität=0.20, `shadowCard` | 18×18-Broschüren-Hotspot; einzige dokumentierte enge Geometrie |
| `accentNoteBottomRight` | X=4, Y=5, Blur=0, Opazität=0.18, `accent` | Harter Illustrationsschatten von `kitchenNoteSheet` |
| `none` | `boxShadow: "none"` | Explizites Zurücksetzen eines Schattens |

Die Geometrien bleiben interne Werte in `ui-shadow.ts`; Feature-Code importiert
keine einzelnen Stufen und fügt keine lokalen Schattenwerte hinzu. Die
Sondergeometrien sind dort mit ihrem konkreten Einsatzort und Grund kommentiert.

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

Produktcode importiert keine internen Schattengeometrien und fügt keine lokalen
Schattenwerte hinzu. Fertige Styles werden über reguläre `style`-Arrays
angewendet:

```tsx
import { uiShadowStyles } from '@/constants/ui-shadow';

<View style={[styles.card, uiShadowStyles.cardBottom]} />
```

## Nachweis

Die Referenz zeigt Radien, Schattenstufen und Verläufe anhand realer zentraler
Werte. Produktkomponenten belegen die Anwendung der gemeinsamen Styles.
iOS-/Android-Prüfung bestätigt Darstellung und Druckweg; Light/Dark-Prüfung
bestätigt Lesbarkeit und Gruppierung. Tokenvisualisierung gilt nicht als Nachweis
für die korrekte Integration in Produktkomponenten.
