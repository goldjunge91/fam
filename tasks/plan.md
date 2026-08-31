# Plan: Übertrag "Fehlende Zutaten → Einkaufsliste"

Spec: `docs/issue-131-missing-ingredients-transfer.md`

## Komponenten & Reihenfolge

```
1. Domänenlogik (shopping-needs.ts)         — Fundament, keine UI-Abhängigkeit
2. Zeilen-Store-Picker (neue Komponente)     — unabhängig, parallel zu 1
3. Meal-Planner-Hook (use-shopping-needs.ts) — hängt an 1
4. Recipe-Hook (use-recipe-shopping-needs.ts)— hängt an 1
5. Meal-Planner-Screen                       — hängt an 2, 3
6. Recipe-Sheet                              — hängt an 2, 4
```

`1` und `2` können parallel gebaut werden. `3`/`4` sind unabhängig
voneinander (beide nutzen nur `1`). `5`/`6` sind unabhängig voneinander,
brauchen aber jeweils `2` plus ihren eigenen Hook.

## 1. Domänenlogik: `shopping-needs.ts`

`computeMissingIngredients` filtert aktuell `missingGrams <= 0.0001`
komplett heraus. Änderung: Filter entfernen, **alle** Produkte mit einem
Bedarf > 0 zurückgeben (auch wenn `missingGrams <= 0`), weiter sortiert
nach `missingGrams` absteigend — Artikel mit echter Lücke bleiben so
automatisch oben, gedeckte Artikel rutschen ans Ende, ohne dass die
Aufrufer selbst sortieren müssen.

`MissingIngredient` (Typ) bleibt unverändert (`neededGrams`,
`availableGrams`, `missingGrams` sind bereits vorhanden) — nur der Filter
fällt weg. Kein Breaking Change für den Typ, nur für die Menge der
zurückgegebenen Einträge (mehr statt weniger).

**Risiko:** beide Aufrufer (`use-shopping-needs.ts`,
`use-recipe-shopping-needs.ts`) verlassen sich aktuell implizit auf
"nur Lücken kommen zurück". Beide müssen beim Umbau mitgezogen werden
(Schritte 3/4), sonst tauchen gedeckte Artikel unbeabsichtigt in der
UI auf, bevor die UI dafür bereit ist. Reihenfolge: 1 und 3/4 in
derselben Änderung/demselben Commit-Schritt halten.

**Verifikation:** `shopping-needs.test.ts` — neuer Fall "Bedarf == Vorrat
taucht mit missingGrams 0 im Ergebnis auf, nicht gefiltert".

## 2. Zeilen-Store-Picker (neue, gemeinsame Komponente)

Ableitung aus `store-picker-menu.tsx` (`StorePickerMenu`): gleicher
anchored-Dropdown-Mechanismus (Modal + `measureInWindow`), aber
Einzelauswahl für eine Zeile statt globaler Filter — Props etwa
`{ householdId, storeId, onChange }` (kein `totalCount`/`countForStore`,
kein "Alle Listen"-Eintrag, kein "+ Neuer Markt" — das deckt
`StorePickerField` an anderer Stelle bereits ab).

Ort: `src/features/shopping-list/components/ui/row-store-picker.tsx`
(gemeinsam von Meal-Planner und Rezept-Sheet genutzt, daher im
domänenlosen `shopping-list`-Feature statt dupliziert in
`meal-planner`/`recipes`).

**Verifikation:** eigener Komponententest (RNTL) — öffnet Dropdown,
zeigt Märkte des Haushalts + "Ohne Markt", `onChange` bei Auswahl.

## 3. Meal-Planner-Hook: `use-shopping-needs.ts`

- Filter auf `missingGrams > 0` beim Aufbau von `result` entfernen —
  jetzt kommen alle Artikel mit Bedarf > 0.
- `MissingIngredientView` um `neededGrams`/`availableGrams` erweitern
  (aus `MissingIngredient` durchreichen, liegen in `computeMissingIngredients`
  bereits vor).

**Verifikation:** `use-shopping-needs.test.tsx` — gedeckter Artikel
erscheint im Ergebnis mit `missingGrams: 0` und korrektem
`neededGrams`/`availableGrams`.

## 4. Recipe-Hook: `use-recipe-shopping-needs.ts`

Gleiche Änderung, gespiegelt: kein `Math.max(1, ...)`-Clamp mehr auf
`missingGrams` (der Clamp verhinderte bisher `0`-Werte künstlich — das
wird jetzt zum Nutzsignal statt zum Rundungs-Workaround), zusätzlich
`neededGrams`/`availableGrams` durchreichen. Kein eigener Test-Datei
vorhanden — Testfälle in `missing-ingredients-screen.test.tsx`-Pendant
für Rezepte ergänzen (`recipe-shopping-sheet.test.tsx`, falls vorhanden,
sonst neu anlegen).

## 5. Meal-Planner-Screen: `missing-ingredients-screen.tsx`

- `IngredientRow`: Anzeige `benötigt / Vorrat` (z. B. `100g / 100g`)
  statt nur `"{missingGrams} g fehlen"`; bei `missingGrams > 0` wie
  bisher "N g fehlen" zusätzlich hervorheben.
- Default-Auswahl (`useEffect` auf `missing`): nur Artikel mit
  `missingGrams > 0` vorauswählen, gedeckte Artikel bleiben unselektiert.
- `RowStorePicker` pro Zeile einbauen, vorbelegt mit
  `item.preferredStoreId`; lokaler State
  `Map<productId, storeId | null>` für Overrides.
- `handleAddSelected`: pro ausgewähltem Artikel `store_id` aus dem
  Override-State (Fallback `item.preferredStoreId`) verwenden; Menge
  bleibt `item.missingGrams > 0 ? item.missingGrams : item.neededGrams`.
- Nach erfolgreichem Übertrag: kurze Erfolgsmeldung, danach
  `router.back()` (Import `expo-router`).

**Verifikation:** `missing-ingredients-screen.test.tsx` — gedeckter
Artikel sichtbar aber nicht vorausgewählt; Auswahl eines gedeckten
Artikels überträgt `neededGrams`; Store-Override wird verwendet; Screen
navigiert nach Übertrag zurück.

## 6. Recipe-Sheet: `recipe-shopping-sheet.tsx`

Gleiche UI-Änderungen wie 5 (Anzeige, Default-Auswahl, `RowStorePicker`,
Mengen-Fallback). `onClose()` bleibt wie heute nach dem Übertrag
bestehen — hier ist nichts am Schließverhalten zu ändern, nur die drei
neuen Verhaltenspunkte kommen dazu.

**Verifikation:** bestehende Recipe-Sheet-Tests erweitern (Datei
ermitteln: `recipe-sheets.test.tsx` laut vorherigem Grep-Treffer).

## Risiken

- **Sortierung/Selektion verschoben:** gedeckte Artikel dürfen die
  echten Lücken in der Liste nicht optisch verdrängen — Sortierung nach
  `missingGrams` absteigend (Schritt 1) stellt das sicher, ohne dass die
  UI selbst sortieren muss.
- **Kein FlashList-Zwang:** beide Listen sind aktuell `.map()` in einem
  scrollenden `Screen`/Sheet (kein `FlatList`/`FlashList`) — bleibt so,
  Artikel-Anzahl pro Rezept/Wochenplan ist klein genug.
- **Store-Override lebt nur lokal im Screen-State**, wird nicht
  persistiert (keine neue `shopping_category_preferences`-artige
  Tabelle) — bewusst minimal, YAGNI.

## Verifikations-Checkpoints

1. Nach Schritt 1: `bun run test -- shopping-needs.test.ts` grün.
2. Nach Schritt 2: neuer Komponententest grün.
3. Nach Schritt 3+4: `bun run test -- use-shopping-needs.test.tsx` grün
   (und Recipe-Pendant, falls vorhanden).
4. Nach Schritt 5+6: betroffene Screen-/Sheet-Tests grün,
   `bun run typecheck`, `bun run check`.
