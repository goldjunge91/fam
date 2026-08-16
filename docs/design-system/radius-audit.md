# Audit: `borderRadius`-Werte

> Bestandsaufnahme für Issue [#122](https://github.com/goldjunge91/fam/issues/122)
> (Design-System). **Entschieden und umgesetzt (2026-08-16):** `Radius` in
> `src/constants/theme.ts` mit 8 konsolidierten Werten. 228 von 233 aktuellen
> Fundstellen verwenden die Tokens; vier weitere bleiben bewusst dynamisch
> und eine Illustrations-Ausnahme bleibt lokal dokumentiert.

## Häufigkeit aller vorkommenden Werte

34 verschiedene `borderRadius`-Literale, keine erkennbare Skala (kein
4er-/8er-Raster o. ä.):

| Wert (px) | Anzahl | Wert (px) | Anzahl | Wert (px) | Anzahl |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 16 | 31 | 17 | 6 | 25 | 1 |
| 12 | 25 | 8 | 5 | 30 | 1 |
| 20 | 20 | 4 | 5 | 33 | 1 |
| 14 | 18 | 13 | 4 | 36 | 1 |
| 11 | 11 | 6 | 3 | 39 | 1 |
| 10 | 11 | 22 | 3 | 40 | 1 |
| 18 | 10 | 15 | 3 | 1 | 1 |
| 3 | 8 | 7 | 2 | | |
| 28 | 8 | 48 | 2 | | |
| 2 | 6 | 32 | 2 | | |
| 19 | 6 | 29 | 2 | | |
| | | 27 | 2 | | |
| | | 24 | 2 | | |
| | | 23 | 2 | | |
| | | 21 | 2 | | |
| | | 9 | 1 | | |
| | | 5 | 1 | | |

## Einsatzorte der zwölf häufigsten Werte

**16px** (31×) — u. a. `segmented-control.tsx`, `product-information.tsx`,
`diary-screen.tsx`, `edit-fridge-item-sheet.tsx`,
`fridge-item-actions-sheet.tsx`, `invite-modal.tsx`,
`barcode-scanner-modal.tsx`, `frequent-products-quick-select.tsx`,
`entry-form-modal.tsx`, `recipe-picker-modal.tsx`, `week-grid.tsx`,
`recipe-template-detail-screen.tsx`, `calorie-carousel.tsx`,
`category-carousel.tsx`, `recipe-rating-sheet.tsx`,
`recipe-shopping-sheet.tsx`, `cooking-mode-screen.tsx`,
`recipe-detail-screen.tsx`, `recipe-log-screen.tsx`, drei
`recipe-wizard-step-*.tsx`, `complete-run-sheet.tsx`, `add-item-modal.tsx`,
`edit-item-modal.tsx`, `store-picker-field.tsx`, `stores-screen.tsx`.
→ größte Gruppe, überwiegend Modals/Sheets und große Karten.

**12px** (25×) — u. a. `date-picker.tsx`, `filter-chip-bar.tsx`,
`segmented-control.tsx`, `snackbar.tsx`, `food-search-screen.tsx`,
`dashboard-screen.tsx`, `household-switcher-modal.tsx`,
`barcode-scanner-modal.tsx`, `product-search-dropdown.tsx`,
`week-grid.tsx`, `missing-ingredients-screen.tsx`,
`cooking-mode-screen.tsx`, `recipe-detail-screen.tsx`,
`recipe-log-screen.tsx`, `recipe-wizard-step-*.tsx`, `add-item-form.tsx`.
→ zweitgrößte Gruppe, eher kleinere Controls/Chips/Felder.

**20px** (20×) — u. a. `date-picker.tsx`, `date-wheel-field.tsx`,
`product-information.tsx`, `wheel-picker-field.tsx`,
`pending-auth-banner.tsx`, `diary-screen.tsx`,
`household-switcher-modal.tsx`, `members-screen.tsx`, `week-grid.tsx`,
`recipes-screen.tsx`, `notification-settings-card.tsx`,
`settings-screen.tsx`, `complete-run-sheet.tsx`, `store-filter-bar.tsx`,
`store-picker-field.tsx`, `stores-screen.tsx`.

**14px** (18×) — u. a. `segmented-control.tsx`,
`add-food-entry-screen.tsx`, `food-search-screen.tsx`,
`fridge-item-actions-sheet.tsx`, `fridge-tab-bar.tsx`,
`meal-planner-screen.tsx`, `recipe-rating-sheet.tsx`, `recipes-screen.tsx`,
`recipe-wizard-step-*.tsx`, `add-item-form.tsx`.

**11px** (11×), **10px** (11×), **18px** (10×), **28px** (8×), **3px** (8×),
**2px** (6×), **19px** (6×), **17px** (6×) — jeweils in einer Handvoll
Screens/Komponenten, u. a. `card.tsx` (28), `fridge-summary-card.tsx` (28),
`compact-action-button.tsx` (11), `menu-button.tsx` (18),
`shopping-item-row.tsx` (11).

Der lange Schwanz (24 Werte mit 1–5 Fundstellen, bis hinunter zu `1px` und
hinauf zu `48px`) ist über sehr viele einzelne Dateien verteilt — für eine
sinnvolle Klassifizierung nach Komponenten-Typ (Karte/Box/Button/Pill/Sheet)
braucht es einen zweiten Durchgang pro Fundstelle, nicht nur die
Häufigkeitszählung hier.

## Beobachtung

Kein 4er-/8er-Grid, keine erkennbare "3 Stufen"-Logik — die Werte wirken wie
direkt aus Figma abgetippte Px-Maße pro Element, nicht aus einer Skala
gewählt. 16/12/20/14 machen zusammen schon >60 % aller Vorkommen; der Rest
ist stark verstreut.

## Zusammenführung krummer Werte (zweiter Durchgang)

Primäre Leitfrage: welche Werte liegen so dicht beieinander (≤ 2px), dass sie am
Bildschirm nicht unterscheidbar sind und vermutlich nur Abtipp-Drift
desselben Figma-Werts sind — im Gegensatz zu Werten, die trotz Nachbarschaft
einen eigenen, deutlich gewichtigen Fundstellen-Block haben und daher
vermutlich *bewusst* anders sind? Der breite Block `23–30 → 28` ist eine
explizite Ausnahme von dieser Leitfrage und muss deshalb visuell geprüft
werden; dort beträgt die größte Änderung 5px.

**Klare Zusammenführungen** (kleiner/vereinzelter Wert kollabiert auf den
dominanten Nachbarn):

| Neuer Anker | Nimmt auf | Begründung | Neue Gesamtzahl |
| --- | --- | --- | --- |
| **2** | 1, 2, 3 | Hairline-Radien, praktisch nicht unterscheidbar | 1+6+8 = 15 |
| **4** | 4, 5 | eng beieinander, beide klein | 5+1 = 6 |
| **8** | 6, 7, 8, 9 | enges Band um 8, kein Wert darin dominant genug für eine eigene Stufe | 3+2+5+1 = 11 |
| **12** | 10, 11, 13 (+12) | wie vorgeschlagen: 10/11 nicht von 12 unterscheidbar, 13 liegt näher an 12 als an 14 | 11+11+4+25 = **51** |
| **16** | 15 (+16) | 15 liegt näher an 16 (1px) als an 14 (1px) — aber 16 ist mit 31 Treffern der dominante Nachbar, 15 hat nur 3 | 3+31 = **34** |
| **20** | 17, 18, 19, 21, 22 (+20) | erst 17/19 in 18 zusammengeführt, dann **18 selbst zusätzlich in 20 aufgelöst** (nur 2px auseinander, keine zwei eigenständigen Stufen nötig) — macht 20 zum alleinigen Wert für den ganzen 17–22-Bereich | 6+10+6+2+3+20 = **47** |
| **28** | 23, 24, 25, 27, 29, 30 | vorläufige Konsolidierung für große Karten; 23–25 ändern sich um 3–5px und brauchen eine visuelle Abnahme | 2+2+1+2+2+1+8 = **18** |

**Entschieden (2026-08-16) — 14px bleibt eigene Stufe.** Lag exakt zwischen
12 (51 nach Zusammenführung) und 16 (34 nach Zusammenführung), war aber mit
18 eigenen Treffern zu gewichtig, um kommentarlos in einen der beiden zu
kollabieren — bleibt eine vierte, eigenständige Stufe zwischen 12 und 16
(u. a. `segmented-control.tsx`, `meal-planner-screen.tsx` nutzen 14 gezielt).

**Sondertail aufgeteilt:** `32`, `39` und `48` beschreiben an fünf Stellen
echte Kreise (64×64, 78×78 oder 96×96) und werden deshalb ohne sichtbare
Änderung `Radius.pill`. Die Dashboard-Werte `33` und `36` wurden visuell mit
2, 28, 32 und dem Ausgangszustand verglichen; entschieden wurde
`Radius.large` (28px) für beide Karten. `40` gehört zu einem
128×128-Illustrationshintergrund und bleibt bewusst lokal: `Radius.large`
würde die bestehende Form sichtbar verändern, `Radius.pill` sie zum Kreis
machen, und eine einzelne Verwendung rechtfertigt keinen globalen Token.

## Ergebnis: konsolidierte Skala — final, umgesetzt

Mit den obigen Zusammenführungen (inkl. 18 → 20, entschieden 2026-08-16)
bleiben **8 statt 34 Werte**: `2 · 4 · 8 · 12 · 14 · 16 · 20 · 28`.

Das deckt sich auffällig gut mit etablierten Praxis-Skalen — Material
Design 3s Shape-Scale ist `4 / 8 / 12 / 16 / 28`, exakt eine Teilmenge
dieser Liste. `14` und `20` sind die "app-eigenen" Zwischenstufen, beide mit
nachweisbar hohem, plausiblem Gewicht (14: 18, 20: 47 Treffer nach
Zusammenführung) — kein Zufallsrauschen, eher ein bewusster
Zwischenschritt aus dem Figma-File.

## Radius nach Komponenten-Rolle — umgesetzt in `theme.ts`

`Radius` in `src/constants/theme.ts`:

- `Radius.hairline` = **2** (Badges, kleine Indikatoren)
- `Radius.xs` = **4** (sehr kompakte Elemente)
- `Radius.sm` = **8** (kleine Chips/Icons)
- `Radius.control` = **12** (Chips, Felder, kleine Buttons — größte Gruppe
  nach 16)
- `Radius.controlLarge` = **14** (eigenständige Stufe, u. a. Segmented
  Control, Essensplaner-spezifische Controls)
- `Radius.card` = **16** (Karten, Listen-Container — mit Abstand
  dominantester Wert app-weit)
- `Radius.sheet` = **20** (Modals/Bottom-Sheets — nimmt den gesamten
  17–22px-Bereich auf, s. o.)
- `Radius.large` = **28** (große Karten, z. B. `Card`-Komponente)
- `Radius.pill` = **999** (voll gerundet, unabhängig von der Elementhöhe)

## Aktueller Migrationsstand

| Gruppe | Anzahl | Entscheidung |
| --- | ---: | --- |
| `Radius.*` | 228 | migriert |
| Dynamisch (`height / 2`, responsive Week-Grid-Werte) | 4 | bewusst unverändert |
| Lokale Illustrations-Ausnahme | 1 | `animated-icon.tsx` bleibt bei 40px |

**Abschlussregel (2026-08-16):** Sichere exakte Zuordnungen wurden direkt
migriert. Ungeklärte Zwischenwerte gehen auf den jeweils nächstgrößeren
Token. Dadurch verwendet `settings-menu.tsx` für `groupBody` jetzt
`Radius.large` (24 → 28px). Echte Kreise verwenden unabhängig von ihrer
Größe `Radius.pill`.

**Entschieden:** `dashboard-screen.tsx` verwendet für `plannedCard` und
`calorieCard` einheitlich `Radius.large` (28px).

Damit ist die statische Radius-Migration abgeschlossen: Es gibt keine
verbleibenden Radius-Werte aus `Spacing.*` und keine numerischen Kreisradien.
Die vier berechneten Radien sind Teil ihrer Größenlogik. Für den einzelnen
`AnimatedIcon` rechtfertigt 40px keinen globalen Token.
