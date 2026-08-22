# Glass-Konzept Einkaufsliste

iOS-Glass-UI-Vorschlag (`/atelier-ui:ios-glass-ui-designer`) für
`src/features/shopping-list/screens/shopping-list-screen.tsx`.

Stand: Vorschlag, noch nicht implementiert.

- `glass-einkaufsliste-mockup.html` — aktueller Mockup-Stand (lokale Kopie).
- Live-Artifact: https://claude.ai/code/artifact/c34d9543-0440-4bef-a5c8-0324c78725ef

## Idee

Glas nur an der Chrome-Ebene, nie im Inhalt — deckt sich mit AGENTS.md
("kein dekoratives Karten-/Pillen-Chrome"). Drei Screens zeigen das:

1. **Alle Listen, oben** (Light) — Large Title, Nav noch ohne Blur.
2. **Alle Listen, gescrollt** (Light) — Nav-Leiste und Markt-Filter werden
   zu Ultra-thin- bzw. Regular-Glas, ein Glas-FAB ersetzt den festen
   "+ Artikel"-Button.
3. **Marktansicht REWE** (Dark) — eine Thick-Glass-Leiste unten trägt
   "Einkaufsmodus starten" + "Einkauf abschließen" statt fester Buttons im
   Scroll-Inhalt.

Markt-Zeilen (`store-summary-card.tsx`) und Kategorie-Listen bleiben
unverändert flach und deckend — nur Navigation, Filter, Hinzufügen-Button
und die untere Aktionsleiste bekommen Material.

Auswahl/Feedback steht noch aus — an echten Komponenten wurde nichts
geändert.
