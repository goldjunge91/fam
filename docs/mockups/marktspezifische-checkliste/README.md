# Marktspezifische Checkliste

Der Screen, den man beim Antippen einer Markt-Zeile in "Alle Listen" sieht: nach Kategorie
sortierte, bearbeitbare Artikelliste eines Marktes (`shopping-list-screen.tsx`, der
`SectionList`-Teil). Nicht zu verwechseln mit dem Einkaufsmodus (`shopping-mode-screen.tsx`,
siehe `docs/mockups/einkaufsmodus/`) — hier bearbeitet man noch, dort hakt man nur ab.

Stand: Vorschlag, noch nicht implementiert.

- `marktspezifische-checkliste-mockup.html` — aktueller Mockup-Stand (lokale Kopie).
- Live-Artifact: https://claude.ai/code/artifact/ce5759d2-cd39-47f0-a8f4-1f940b284d59

## Verlauf

1–4. Frühere Runden (Fortschrittszeile, Nährwerte inline, Produktdetailseite mit Foto/Badges)
verworfen bzw. überarbeitet — Details in der Git-Historie dieser Datei.

5. Fünfte Runde, komplett neu am realen Vorbild aufgesetzt: `inventory-item-actions-sheet.tsx`
   (Kühlschrank-Feature) hat schon ein fertiges Aktions-Menü. Die vorherige Fassung wirkte zu
   sehr nach generischem Mockup (Fraunces-Überschriften, gestrichelte "Vorschlag"-Boxen,
   Badge-Reihen) statt nach echter App — jetzt 1:1 an bestehenden Komponenten orientiert.

## Aktueller Stand

- **Wischgeste statt Checkbox** — kurz nach links wischen zeigt "Bearbeiten", weiter gewischt
  wechselt dieselbe Fläche zu "Löschen" (Fortsetzung einer Geste, kein zweiter Button daneben).
  Technisch: `ReanimatedSwipeable` wie in `inventory-item-row.tsx`, um eine zweite Schwelle
  erweitert (aktuell nutzt die Komponente `progress`/`translation` aus `renderRightActions`
  noch nicht — genau dafür gedacht).
- **Bearbeitungsmenü** — 1:1 die Struktur von `inventory-item-actions-sheet.tsx` /
  `fridge-actions-*`-Klassen: Ziehgriff, Kopfzeile mit Farbstreifen, zwei Aktions-Pillen
  (Bearbeiten neutral, Löschen rot getönt), Info-Zeile unten. Öffnet sich beim Antippen der
  Zeile (Alternative zum Loslassen mitten in der Wischgeste).
- **Produktinformationen** — "Produktinformationen" im Menü öffnet die Nährwerte in derselben
  Karten-Sprache wie `card-fam` (die reale `Card`-Komponente): alle sieben echten Felder aus
  `products` (Energie, Fett, Kohlenhydrate — davon Zucker, Ballaststoffe, Eiweiß, Salz), Marke
  und EAN. Keine erfundenen Badges/Platzhalter mehr — nur was die Datenbank wirklich hat.

Auswahl/Feedback steht noch aus — an echten Komponenten wurde nichts geändert.
