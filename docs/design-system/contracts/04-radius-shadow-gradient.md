# Vertrag: Radien, Schatten und Verläufe

## Zweck und Zuständigkeit

Form und Tiefe bleiben über Screens konsistent. `radius`, `shadow`, `BUTTON_DEPTH`,
`Gradients` und `GradientSpec` stammen aus `index.ts`. Ihre semantische Verwendung
in Cards, Buttons, Overlays und anderen Komponenten wird in `ui.tsx` definiert.
`Fonts` gehört zum [Typografievertrag](./02-typography.md).

## Form und Tiefe

- Radien wählen die zentralen Werte von `radius.sm` bis `radius.pill`.
  Wiederkehrende neue Formen brauchen eine zentrale Entscheidung.
- Schattenrezepte verwenden die aktive Palette aus dem ThemeProvider. Ein
  unveränderter Spread von `shadow.sm` im Feature ist kein semantisches Rezept.
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
import { Button } from '@/components/ui/buttons';
import { Txt } from '@/constants/ui';

<Card title="Vorrat">
  <Txt tone="secondary">12 Produkte</Txt>
  <Button label="Speichern" onPress={save} />
</Card>
```

Die Card und der Button wenden ihre gemeinsamen Rezepte intern an. Das frühere
positive Beispiel `<View style={{ borderRadius: radius.md, ...shadow.sm }} />`
ist als Empfehlung für Feature-Code nicht zulässig. Ein solcher Rohwertvergleich
darf nur als eindeutig beschriftete Tokenvisualisierung der Entwicklerreferenz
oder an einer konkret begründeten nativen Grenze vorkommen.

## Nachweis

Die Referenz zeigt Radien, Schattenstufen und Verläufe anhand realer zentraler
Werte. Produktkomponenten belegen die Anwendung der gemeinsamen Rezepte.
iOS-/Android-Prüfung bestätigt Darstellung und Druckweg; Light/Dark-Prüfung
bestätigt Lesbarkeit und Gruppierung. Tokenvisualisierung gilt nicht als Nachweis
für die korrekte Integration in Produktkomponenten.
