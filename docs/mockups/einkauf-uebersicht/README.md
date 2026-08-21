# Einkauf Übersicht ("Alle Listen")

Weiterentwicklung der Markt-Karten-Übersicht in `shopping-list-screen.tsx`. Abgleich mit dem
bestehenden Code (`store-summary-card.tsx`, `store-picker-menu.tsx`, `shopping-categories.ts`)
und den beiden vorherigen Mockups ("Einkauf Redesign", "Supermarkt-Modus").

Stand: Vorschlag, noch nicht implementiert.

- `einkauf-uebersicht-mockup.html` — aktueller Mockup-Stand (lokale Kopie).
- Live-Artifact: https://claude.ai/code/artifact/8584e66a-7461-400b-88c0-f79a304f181d

## Ausgangslage

Farbstreifen-Karten je Markt mit Accent-Fortschrittsbalken und Gesamtschätzung sind bereits
gebaut — im Kern schon "Variante A" aus dem ersten Mockup
(https://claude.ai/code/artifact/a35b232f-1e8c-4341-82dc-d8e782de2483). Dieser Mockup geht
deshalb nicht mehr um Kartenchrome vs. Liste, sondern um vier konkrete Lücken:

1. **Doppelter Weg zum Markt** — Glass-Pill-Filter im Header und Karten in "Alle Listen" listen
   dieselben Märkte zweimal.
2. **"Ohne Markt" gleichrangig mit echten Märkten** — sitzt optisch wie ein normaler Markt
   zwischen REWE, Bio-Markt & Co.
3. **Kein Direktstart aus der Übersicht** — der Einkaufsmodus-Button steht nur in der
   Marktansicht, nicht in "Alle Listen".
4. **Kategorien unsichtbar in der Übersicht** — man sieht erst nach dem Öffnen eines Markts,
   was fachlich noch fehlt.

## Zwei Varianten

- **1 · Direktstart-Karten** — heutige Karte, plus 🛒-Direktknopf sobald ein Markt schon
  Fortschritt hat, plus sichtbarer Trenner vor "Ohne Markt".
- **2 · Kompakt mit Kategorievorschau** — dichtere Zeile statt Karte (mehr Märkte ohne Scrollen
  sichtbar), Kategorie-Farbpunkte aus `shopping-categories.ts` zeigen offene Bereiche, Häkchen
  bei vollständig erledigten Märkten.

Auswahl steht noch aus — an echten Komponenten wurde nichts geändert.
