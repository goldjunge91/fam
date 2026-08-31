# Übertrag "Fehlende Zutaten → Einkaufsliste": drei offene Verhaltensfragen

## Ziel

Drei UX-/Verhaltenslücken im bestehenden, Premium-gateten Übertragsflow (#131,
Umsetzung in `missing-ingredients-screen.tsx` und `recipe-shopping-sheet.tsx`)
schließen:

1. Artikel ohne Marktzuweisung.
2. Artikel, die der Vorrat bereits deckt, aber der Nutzer trotzdem
   nachkaufen will.
3. Der Wochenplan-Screen navigiert nach dem Übertrag nicht automatisch
   zurück.

Betrifft nur den bestehenden Premium-Übertrag (#131). #132
(vollautomatische Übernahme ohne Kuratierung) bleibt ein eigenes,
unverändertes Folge-Issue.

## Verbindliche Entscheidungen (2026-08-31)

### 1. Artikel ohne Marktzuweisung

`store_id: null` bleibt ein regulärer Zustand — die Einkaufsliste hat
schon einen "Ohne Marktzuordnung"-Filter (`shopping-list-screen.tsx`,
`unassignedItems`). Neu: der Nutzer bekommt in der Vorschlagsliste selbst
die Möglichkeit, jedem Artikel (mit **und** ohne Kaufhistorie) einen der
angelegten Märkte des Haushalts zuzuweisen, statt sich auf den
History-Vorschlag verlassen zu müssen.

- Jede Zeile in `IngredientRow` (`missing-ingredients-screen.tsx`) und
  im Pendant in `recipe-shopping-sheet.tsx` bekommt einen kompakten
  Markt-Picker. Vorbelegt mit `preferredStoreId` aus der Kaufhistorie
  (bisheriges Verhalten), bei `null` mit "Ohne Markt".
- UI-Vorbild: der anchored Dropdown aus `store-picker-menu.tsx`
  (`StorePickerMenu`) — dort Filter-Auswahl über alle Märkte, hier
  angepasst auf Einzelauswahl pro Zeile statt globalem Filter. Kein
  neuer "+ Neuer Markt"-Flow nötig (das leistet bereits
  `StorePickerField` an anderer Stelle); hier reicht Auswahl aus
  bestehenden Märkten + "Ohne Markt".
- Die getroffene Auswahl überschreibt beim Übertrag `store_id` in
  `addShoppingItem.mutateAsync` (statt immer automatisch
  `item.preferredStoreId` zu verwenden).
- Menge bleibt in jedem Fall unverändert vom Rezept/aus der Zutatenliste
  übernommen (`missingGrams` bzw. bei gedeckten Artikeln `neededGrams`,
  siehe Punkt 2) — der Markt-Picker ändert nur die Marktzuordnung, nie
  die Menge.

### 2. Artikel, die der Vorrat bereits deckt (Nachschub)

**Primärlösung:** `computeMissingIngredients` filtert Artikel mit
`missingGrams <= 0` aktuell komplett aus der Ergebnisliste heraus — sie
sind für den Nutzer unsichtbar. Stattdessen: **alle** Rezeptzutaten des
Wochenplans in der Vorschlagsliste anzeigen, nicht nur das Delta. Jede
Zeile zeigt benötigte Menge / Vorratsmenge, z. B. `100g / 100g` bei voll
gedecktem Bedarf oder `150g / 50g` bei einem Fehlbetrag von 100g.

- Ausreichend gedeckte Artikel sind **standardmäßig nicht ausgewählt**
  (Checkbox leer) — das heutige Verhalten für echte Lücken (automatisch
  vorausgewählt) bleibt unverändert.
- Wählt der Nutzer einen bereits gedeckten Artikel aus, wird die
  **volle benötigte Menge** (`neededGrams`), nicht die Differenz, zur
  Einkaufsliste hinzugefügt — bei einer Differenz von 0 oder negativ gibt
  es sonst nichts sinnvolles zu übertragen.
- Sortierung: Artikel mit echtem Fehlbetrag zuerst (wie heute), gedeckte
  Artikel danach, damit die eigentliche Lücke weiterhin sofort sichtbar
  ist.

**Zurückgestellte Erweiterungen** (bewusst nicht Teil dieses Specs, YAGNI
— erst umsetzen, wenn tatsächlich gebraucht):

- Manuelles Hinzufügen per Produktsuche direkt aus dem Sheet heraus
  (bestehende Einkaufslisten-Suche deckt diesen Fall bereits ab, kein
  Duplikat nötig).
- Toggle "Nachschub mit einplanen", der die Vorratsgrenze global
  ignoriert — durch die zusammengeführte Liste aus Punkt 2 überflüssig,
  da ohnehin alle Zutaten sichtbar sind.

### 3. Screen schließt nicht nach dem Übertrag

Nur `missing-ingredients-screen.tsx` betroffen — `recipe-shopping-sheet.tsx`
ruft `onClose()` bereits korrekt nach dem Übertrag auf und ist das
Referenzverhalten.

`handleAddSelected` in `missing-ingredients-screen.tsx` navigiert nach
erfolgreichem Übertrag automatisch zurück (`router.back()`), statt nur
`addedCount` inline anzuzeigen. Kurze Erfolgsmeldung (z. B. `Alert.alert`,
analog zum Sheet-Pattern) vor der Navigation, damit die Bestätigung nicht
verloren geht.

## Betroffene Dateien

- `src/features/meal-planner/use-shopping-needs.ts` — `stockRows`/`needs`
  nicht mehr vorfiltern; Rückgabetyp um `neededGrams`/`availableGrams`
  erweitern (liegen in `MissingIngredient` bereits vor, nur bislang nicht
  bis zur View durchgereicht).
- `src/features/meal-planner/shopping-needs.ts` —
  `computeMissingIngredients` liefert testbar wahlweise Delta oder
  Voll-Report; ggf. neue Funktion statt Verhaltensänderung der
  bestehenden (Testabdeckung in `shopping-needs.test.ts` prüfen).
- `src/features/meal-planner/missing-ingredients-screen.tsx` — Anzeige
  `benötigt / Vorrat`, Fallback-Text ohne Markt, `router.back()` nach
  Übertrag.
- `src/features/recipes/data/use-recipe-shopping-needs.ts` +
  `recipe-shopping-sheet.tsx` — dieselbe Logik für den Rezept-Einzelfall
  spiegeln (gleiches Muster wie beim Wochenplan-Fall).
- Neue Komponente für den Zeilen-Markt-Picker (Ableitung aus
  `store-picker-menu.tsx`, Einzelauswahl statt Filter), von beiden
  Screens gemeinsam genutzt statt zweimal implementiert.
- `src/features/shopping-list/hooks/use-stores.ts` — Märkte des
  Haushalts laden (bereits vorhanden, nur neuer Konsument).

## Testing

- `shopping-needs.test.ts`: neue Fälle für voll gedeckten Bedarf (muss
  jetzt im Ergebnis auftauchen, nicht mehr gefiltert werden) und für
  `neededGrams`-Übertrag bei Auswahl eines gedeckten Artikels.
- `missing-ingredients-screen.test.tsx`: Navigation nach Übertrag
  (`router.back()` aufgerufen), Fallback-Text ohne Markt.
- `use-shopping-needs.test.tsx`: Rückgabe enthält jetzt auch gedeckte
  Artikel mit `missingGrams === 0`.

## Boundaries

- **Immer:** bestehendes Premium-Gate (#131/#132-Entscheidung) unverändert
  lassen; `resolveCategoryForItem`-Resolver für jede Erzeugung weiter
  nutzen (#223 Abschnitt 10).
- **Vorher fragen:** falls die Umbenennung/Erweiterung von
  `computeMissingIngredients` bestehende Aufrufer außerhalb dieser beiden
  Screens betrifft.
- **Nie:** die Kernberechnung (Bedarf minus Vorrat) für die
  Standardauswahl der Checkboxen ändern — nur die Sichtbarkeit gedeckter
  Artikel wird erweitert, ihr Auswahl-Default bleibt "aus".

## Erfolgskriterien

- [ ] Vorschlagsliste zeigt alle Rezeptzutaten des Wochenplans/Rezepts,
      inkl. bereits gedeckter, mit `benötigt / Vorrat`-Anzeige.
- [ ] Gedeckte Artikel sind vorausgewählt: aus; bei Auswahl wird die volle
      benötigte Menge übertragen.
- [ ] Jede Zeile der Vorschlagsliste hat einen Markt-Picker (vorbelegt
      mit Kaufhistorie oder "Ohne Markt"); die Auswahl bestimmt
      `store_id` beim Übertrag, die Menge bleibt davon unberührt.
- [ ] `missing-ingredients-screen.tsx` navigiert nach erfolgreichem
      Übertrag automatisch zurück.
- [ ] `recipe-shopping-sheet.tsx` bleibt beim bestehenden, bereits
      korrekten Schließverhalten.

## Offene Fragen

- Exakter Anzeige-Text/-Format für `benötigt / Vorrat` (z. B. Einheit
  immer `g`, oder auf die im Rezept verwendete Einheit umrechnen?) —
  Vorschlag: `g`, konsistent mit `missingGrams` heute.

## Nachschärfung 2 (2026-08-31): Doppelzählung bei wiederholter Nutzung

**Problem (bestätigt, noch nicht behoben):** `computeMissingIngredients`
rechnet Bedarf minus **physischer Vorrat** (`fridge_items`), nicht minus
dem, was bereits ungecheckt auf der Einkaufsliste liegt. Szenario:

1. Bolognese am Montag geplant. Bedarf 400g Tomaten, Vorrat 100g →
   Übertrag legt 300g Tomaten auf die Einkaufsliste.
2. Bolognese zusätzlich für Mittwoch geplant. Gesamtbedarf steigt auf
   800g, Vorrat unverändert 100g → Vorschlagsliste zeigt jetzt 700g als
   fehlend, ohne zu wissen, dass 300g schon auf der Liste stehen.
3. Erneuter Übertrag: `addOrMergeShoppingItem`
   (`src/lib/db/shopping-list-merge.ts`) addiert die neuen 700g zur
   bestehenden Zeile → 1000g auf der Liste, obwohl nur 800g gebraucht
   werden. Überzählung um genau die zuvor schon übertragene Menge.

**Noch nicht entschieden — braucht Mockups vor der Festlegung.** Drei
Lösungsrichtungen sind gleichwertig plausibel, keine davon verworfen:

1. **Verrechnen:** "verfügbar" = Vorrat + bereits ungecheckt auf der
   Einkaufsliste stehende Menge desselben Produkts. Jedes erneute Öffnen
   zeigt automatisch die echte Restmenge, wiederholter Übertrag bleibt
   korrekt ohne Nutzerzutun.
2. **Nur Warnhinweis:** Vorschlagsliste zeigt weiterhin die volle
   berechnete Menge, ergänzt um einen Hinweis "X g bereits auf der
   Einkaufsliste" — Nutzer entscheidet selbst, ob er trotzdem die volle
   Menge übernimmt.
3. **Ersetzen statt addieren:** Der Übertrag ersetzt die Menge auf der
   Einkaufsliste durch den frisch berechneten Gesamtbedarf minus Vorrat,
   statt sie zur bestehenden Zeile zu addieren (Abkehr vom
   Merge-Add-Verhalten für aus diesem Flow stammende Artikel).

Mockups für alle drei Varianten folgen, Entscheidung danach.

## Ausdrücklich außerhalb dieses Scopes

**"Vorwoche übernehmen" hat keinen Duplikat-Schutz** —
`useReuseLastWeekMutation` (`src/features/meal-planner/use-meal-plans.ts`)
fügt beim Kopieren jeden Eintrag ungeprüft ein, kein Abgleich, ob
(Rezept, Tag, Mahlzeit) in der Zielwoche schon existiert. Zweimal
geklickt dupliziert jedes Gericht der Woche. Bestätigt als echte Lücke,
aber **bewusst nicht Teil dieser Nachschärfung** — der Button selbst
wird separat überarbeitet (Scope und Zeitpunkt noch offen).
