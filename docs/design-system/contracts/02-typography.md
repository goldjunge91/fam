# Vertrag: Typografie

Txt-Varianten und ihre Darstellung stehen in [ui.tsx](../../../src/constants/ui.tsx).
Schriftmaße und Schriftfamilien stehen in [index.ts](../../../src/components/theme/index.ts).
Diese Dateien besitzen die konkreten Werte.

## Varianten und Overrides

- Wiederkehrende Textrollen verwenden eine bestehende Txt-Variante oder ein
  gemeinsames Komponentenrezept.
- Ein lokaler Gewichtungs-Override darf eine einzelne Textstelle hervorheben,
  ersetzt aber keine gemeinsame Rolle.
- Lokale Styles dürfen Breite und Anordnung festlegen, nicht wiederkehrende
  Schriftgrößen, Zeilenhöhen, Schriftfamilien oder Textfarben.
- Eine gleiche Kombination aus Variante, Ton und Gewicht beweist für sich
  genommen keine gemeinsame semantische Rolle.
- Die plattformgerechten Schriftfamilien stammen aus dem Theme-Owner.

## Skalierung und Lesbarkeit

Die zentrale, begrenzte Skalierung bleibt in index.ts. Features führen keine
zweite Typografieskala ein. Bei begrenzter Inhaltsbreite darf zusätzlicher Platz
nicht unnötig in größere Schrift umgesetzt werden.

Die Fensterbreite für importierte Themewerte wird beim Modulimport gelesen.
Dieser Vertrag verlangt keine zusätzliche useWindowDimensions-Schicht und
behauptet keine reaktive Neuberechnung bei Rotation oder Web-Resize. Lokale
Layouts dürfen Laufzeitmaße mit dem zuständigen Hook bestimmen.

Die Systemschriftvergrößerung bleibt aktiv; sie wird weder pauschal begrenzt
noch durch eine kleinere App-Skalierung kompensiert. Bei schmaler Breite dürfen
Zeilen, Container und Aktionen wachsen. Notwendige Inhalte bleiben erreichbar.
Gezielte Textkürzung ist nur zulässig, wenn die vollständige Information
zugänglich bleibt. Fehlermeldungen werden nicht pauschal abgeschnitten.

Die konkrete Lesbarkeit kleinster Textrollen wird in der tatsächlichen
Darstellung beurteilt; der Skalierungsfaktor allein ist kein Nachweis.

## Prüfung

Die Referenz zeigt vorhandene Textrollen in Light und Dark. Native Prüfung mit
normaler und großer Systemschrift belegt Umbruch, vollständige Glyphen und
erreichbare Aktionen.
