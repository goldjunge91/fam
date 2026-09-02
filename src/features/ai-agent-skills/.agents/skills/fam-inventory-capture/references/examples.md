# Beispiele: `fam-inventory-capture`

## Gültige Extraktion

Aus „zwei Paprika und etwas Spinat“ werden zwei Items. Für Paprika darf die
Menge `2` übernommen werden. Für Spinat bleibt `quantity: null`, wenn der Text
keine Menge nennt; `missingFields` enthält dann mindestens `quantity`.

## Ungültige Antworten

- Aus „etwas Spinat“ `200 g` ableiten.
- Ein Datum oder eine Sicherheitsfreigabe erfinden.
- Das Proposal direkt in `fridge_items` schreiben.
- `householdId` aus dem Freitext übernehmen.
- Den Koch-Skill oder `tools/category-debugger` aufrufen.