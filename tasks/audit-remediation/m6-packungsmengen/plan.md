# M6: Packungsmaße im Einkaufsbedarf berücksichtigen

Priorität: Medium. Reihenfolge: Phase 4.
Maßgeblicher Bead: `fam-n71d`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für M6 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

Die Bedarfshooks verwerfen package_size und package_size_unit. Der gemeinsame Mengenpfad benutzt dann das Portionsgewicht für eine Packung und unterschätzt den Bestand.


## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-n71d.1` | Lot-Packungsmaße im bestehenden Mengen-Owner korrekt umrechnen |
| 2 | `fam-n71d.2` | Rezept- und Wochenplanbedarf mit Lot-Packungsmaßen versorgen |


## Vorgehen

1. In fam-n71d.1 Lot-eigene Größe und Einheit im vorhandenen Mengen-Owner berücksichtigen.
2. Zwei 500-g-Packungen mit 50-g-Portion als 1000 g sowie verschiedene Lose und unbekannte Maße prüfen.
3. In fam-n71d.2 die Packungsmaße aus Rezept- und Wochenplanqueries vollständig durchreichen.
4. Beide echten Bedarfshooks auf ausbleibende unnötige Nachkäufe prüfen und ihre jeweilige Persistenzkonvertierung erhalten.

## Dateiscope

- `src/features/meal-planner/shopping-needs.ts`
- `src/features/meal-planner/shopping-needs.test.ts`
- `src/lib/units.ts nur bei tatsächlich fehlender bestehender Konvertierung`
- `src/lib/units.test.ts nur bei Owner-Anpassung`
- `src/features/meal-planner/use-shopping-needs.ts`
- `src/features/meal-planner/use-shopping-needs.test.tsx`
- `src/features/recipes/data/use-recipe-shopping-needs.ts`
- `src/features/recipes/data/use-recipe-shopping-needs.test.tsx`


## Abhängigkeiten

Keine fachliche Vorbedingung aus einem anderen Problemplan. Gemeinsame Dateigrenzen und Betriebsfreigaben bleiben zu beachten.

## Gezielte Verifikation

- Reine Mengentests mit g/kg, Teilmengen, verschiedenen Losen und unbekannten Maßen.
- Vorhandene Mengen-Grenzen und Persistenzkonvertierung beibehalten.
- Keine umfassende Inventory-Mengenmigration in diesem Slice.
- Gezielte Tests beider Shopping-Needs-Hooks mit realen Lot-Maßen.
- Reiner 1000-g-Zahlennachweis bleibt grün.
- App-Typecheck und berührte Biome-Dateien.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-n71d`. Der vorgesehene fachliche Abnahmerahmen lautet:

- Lot-Packungsmaße werden fachlich korrekt umgerechnet.
- Rezept- und Wochenplanverbraucher liefern diese Maße vollständig.
- Zwei 500-g-Packungen decken 1000 g Bedarf; beide Hook-Grenzen und verschiedene Lose sind getestet.


## Grenzen und Entscheidungen

Keine gesamte Inventory-Mengenmigration, keine zweite Mengenrepräsentation und keine neuen stillen Dichteannahmen.

Unbekannte Maße bleiben ausdrücklich nicht umrechenbar; bekannte Packungsmaße werden nicht vom Portionsgewicht überschrieben.
