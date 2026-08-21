# Einkaufsmodus (Supermarkt-Ansicht)

Vollbild-Modus für die Einkaufsliste zum Abhaken im Laden — ohne Bearbeiten-Chrome
(kein Löschen/Umbenennen/Reihenfolge, das bleibt in der bestehenden Marktliste).
Aufbauend auf der Laufstrecken-Kategorisierung aus
`docs/features/Supermarkt Laufstrecke - Einkaufslisten Sortierung.md`.

Stand: implementiert (`shopping-mode-screen.tsx`).

- `supermarkt-modus-mockup.html` — aktueller Mockup-Stand (lokale Kopie).
- Live-Artifact: https://claude.ai/code/artifact/0bf422b1-538f-4315-91b4-d75f49e1d48e

## Kernpunkte

- Farbcodierte, auf-/zuklappbare Kategorien (automatisch eingeklappt sobald komplett,
  manuell einklappbar).
- Drei Spalten: Produkt · Menge · Preis.
- Einstieg über "🛒 Einkaufsmodus starten" unten in der Marktliste, Ausstieg über ✕ oder
  sobald alles abgehakt ist.
- Löschen/Umbenennen/Reihenfolge/Hinzufügen bleiben ausschließlich in der Marktliste.
- Im Abschluss-Sheet (`complete-run-sheet.tsx`, unverändert) ist die Menge jetzt per
  Antippen mit einfacher Zifferneingabe korrigierbar (z. B. weniger Brötchen als geplant).
