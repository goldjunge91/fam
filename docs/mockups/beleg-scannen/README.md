# Beleg scannen (Kassenbon erfassen)

Statisches HTML-Mockup fuer den Capture-Screen des Kassenbon-Workflows
(`ocr.review.capture*`, siehe `src/i18n/features/ocr.de.json`).

Datei: `beleg-scannen-mockup.html`

## Stand

Variante A **ohne Schrittzahler**. Gezeigt wird Light und Dark, jeweils auf
derselben Rollenverteilung. Weitere Kopfvarianten wurden verworfen.

## Unveraendert gegenueber A

Dunkler Screen auf `viewerBackground`, Titel direkt unter dem Kopf, Rahmen mit
gelben Ecken und Scanlinie, Vorschau-Plakette oben rechts, Hinweiszeile mit
Punkt, Shutter rechts mit Galerie-Feld daneben.

## Entfernt

Der Schrittzahler `1 von 2` samt Kopfzeile. Die Zeile
`Lege den ganzen Bon in den Rahmen.` benennt die Aufgabe; die Zahl traf keine
Entscheidung und nahm Platz im Kopf.

## Farben

Alle Werte 1:1 aus `src/components/theme/index.ts`:

| Rolle im Mockup | Token |
| --- | --- |
| Screen-Flaeche | `viewerBackground` |
| Rahmen, Buttons, Icon-Flaeche | `backgroundElement` / `backgroundSoft` |
| Titel, Hinweis auf dem Viewer | `text` gegen `viewerBackground` |
| Vorschau-Plakette | `backgroundElement` mit `accent` |
| Rahmenecken | `warning` |
| Scanlinie, Ausloeser | `danger` mit `onDanger` |
| Erkennungs-Punkt | `success` |

Der Bon im Rahmen nutzt `backgroundElement` (light) und `text`, weil er
Bildinhalt darstellt, nicht UI. Keine Farbe ausserhalb dieser Tokens.

## Offen

- Kopfbereich: nur zwei Icon-Buttons ohne Titel. Ob ein Titel dort gehoert,
  ist im Screenvertrag 09 (`chrome` vs. `back`) noch nicht entschieden.
- Die Gallery-Aktion ist als Feld neben dem Ausloeser gezeigt, nicht als
  Vollbreiten-Button. Das entspricht der Vorlage, muss aber gegen die
  Touch-Ziel-Groessen aus Vertrag 07 geprueft werden.
- Variante C (Fortschrittsbalken und Thumbnail-Leiste fuer mehrseitige Bons)
  wurde nicht weiterverfolgt. Bei Bedarf neu aufnehmen.
