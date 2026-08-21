# Marktliste ("Märkte verwalten")

Weiterentwicklung von `stores-screen.tsx` — passend zur nun gewählten kompakten
Einkaufsübersicht (siehe `docs/mockups/einkauf-uebersicht/`).

Stand: Vorschlag, noch nicht implementiert.

- `marktliste-mockup.html` — aktueller Mockup-Stand (lokale Kopie).
- Live-Artifact: https://claude.ai/code/artifact/05d3cfbd-9802-4e57-833c-12794b94de26

## Ausgangslage

Aktuell trägt jede Marktzeile zwei volle `Button`-Komponenten ("Bearbeiten" / "Löschen")
untereinander, Inline-Editing ersetzt Name+Farbe+Buttons komplett durch ein neues Formular in
derselben Zeile. Bei mehreren Märkten dominieren die Buttons die Liste stärker als die Märkte
selbst — der auffälligste Bruch zur jetzt kompakten Einkaufsübersicht.

## Zwei Varianten

- **1 · Inline-Edit, kompakt** — Icon-Aktionen (Stift/Papierkorb) statt Button-Paar. Bearbeiten
  klappt dieselbe Zeile auf, Speichern/Abbrechen bleiben dort — kein Sheet, kein Screenwechsel.
- **2 · Bearbeiten-Sheet** — Liste bleibt beim Bearbeiten unverändert lesbar. Antippen der Zeile
  öffnet ein Sheet (gleiches Muster wie `complete-run-sheet.tsx` / `category-order-sheet.tsx`),
  Löschen wandert als eigene Aktion ins Sheet.

Auswahl steht noch aus — an echten Komponenten wurde nichts geändert.
