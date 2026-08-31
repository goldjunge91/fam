# Implementation Plan: Übertrag "Fehlende Zutaten → Einkaufsliste" (#131-Nachschärfung)

Spec: `docs/issue-131-missing-ingredients-transfer.md`
Tasks tracked in: **bd (beads)** — siehe CLAUDE.md/AGENTS.md, Beads ist der
designierte Tracker dieses Projekts. Diese Datei bleibt der Plan
(Architektur, Reihenfolge, Risiken, offene Fragen); die Task-Liste unten
ist ein Index der bd-/GitHub-Issue-IDs, keine eigene Checkliste.

## Overview

Drei UX-/Verhaltenslücken und ein Datenkonsistenz-Bug im bestehenden,
Premium-gateten Übertragsflow "Fehlende Zutaten → Einkaufsliste" (#131)
schließen: fehlende Marktzuweisung pro Artikel, verschwindende bereits
gedeckte Artikel (Nachschub-Fall), fehlende Rücknavigation nach dem
Übertrag — plus zwei während der Umsetzung gefundene Zusatzpunkte
(Bulk-Marktzuweisung, Button-Sperre über die volle Übertragsdauer) und
ein bewusst zurückgestellter Punkt (Doppelzählung bei Mehrfachnutzung
desselben Gerichts).

## Architecture Decisions

- **Domänenlogik zuerst, gemeinsam für beide Aufrufer.**
  `computeMissingIngredients` (`shopping-needs.ts`) ist die einzige
  Stelle, die den Filter auf `missingGrams > 0` entfernt bekommt — beide
  Hooks (`use-shopping-needs.ts` für den Wochenplan,
  `use-recipe-shopping-needs.ts` für ein Einzelrezept) erben die
  Änderung, statt sie zweimal zu bauen.
- **Ein gemeinsamer Zeilen-Markt-Picker statt Duplikat.**
  `RowStorePicker` liegt bewusst im domänenlosen
  `shopping-list`-Feature (nicht in `meal-planner` oder `recipes`),
  weil beide Screens ihn brauchen — Ableitung aus dem bestehenden
  `StorePickerMenu`-Dropdown-Mechanismus statt einer Neuerfindung.
- **Eigener `isSubmitting`-State statt `mutation.isPending`.**
  Beide Übertrags-Handler rufen `addShoppingItem.mutateAsync` im Loop
  pro Artikel auf — die Mutation selbst flackert zwischen den Aufrufen
  auf `false`. Ein lokaler State über die gesamte Funktion ist die
  korrekte Sperre, kein zusätzliches State-Management-Konzept nötig.
- **`SyncStatusView` verliert `'syncing'` komplett statt es nur zu
  verstecken.** Kein toter Code für einen Zustand, der nach der
  Entscheidung nie wieder erreicht wird (Local-First: Online-Sync ist
  unsichtbar, nur Offline-Rückstand/Fehler sind meldenswert).
- **Store-Override lebt nur lokal im Screen-State**, keine neue
  Persistenz-Tabelle — bewusst minimal (YAGNI), bis sich ein
  wiederkehrender Bedarf zeigt.

## Dependency Graph

```
1. shopping-needs.ts (Domänenlogik, Filter entfernen)
   │
   ├── 3. use-shopping-needs.ts (Meal-Planner-Hook)
   │        │
   │        └── 5. missing-ingredients-screen.tsx ──┐
   │                                                  │
   └── 4. use-recipe-shopping-needs.ts (Recipe-Hook)  │
            │                                         │
            └── 6. recipe-shopping-sheet.tsx ──────────┤
                                                        │
2. RowStorePicker (unabhängig, parallel zu 1)  ────────┘
   (wird von 5 und 6 konsumiert)
```

`1` und `2` sind voneinander unabhängig und parallelisierbar. `3`/`4`
hängen nur an `1`, sind untereinander unabhängig. `5`/`6` sind
untereinander unabhängig, brauchen aber jeweils `2` plus ihren eigenen
Hook (`5` → `3`, `6` → `4`).

## Task List

Foundation (parallelisierbar):
- [x] [fam-zqh](https://github.com/goldjunge91/fam/issues/334) — `shopping-needs.ts`: Filter entfernen, alle Artikel zurückgeben
- [x] [fam-ua3](https://github.com/goldjunge91/fam/issues/335) — Neue Komponente `RowStorePicker`

### Checkpoint: Foundation
- [x] `bun run test -- shopping-needs.test.ts` grün
- [x] Eigener Komponententest für `RowStorePicker` grün

Hooks (je an Foundation gebunden, untereinander unabhängig):
- [x] [fam-1ot](https://github.com/goldjunge91/fam/issues/336) — `use-shopping-needs.ts`: `neededGrams`/`availableGrams` durchreichen
- [x] [fam-3zy](https://github.com/goldjunge91/fam/issues/337) — `use-recipe-shopping-needs.ts`: dito, `Math.max(1,...)`-Clamp entfernt

### Checkpoint: Hooks
- [x] `bun run test -- use-shopping-needs.test.tsx use-recipe-shopping-needs.test.tsx` grün

Delivery (vertikale Slices, je ein vollständiger Screen inkl. UI):
- [x] [fam-1sh](https://github.com/goldjunge91/fam/issues/338) — `missing-ingredients-screen.tsx`: Anzeige, Default-Auswahl, Markt-Picker, Rücknavigation
- [x] [fam-7kn](https://github.com/goldjunge91/fam/issues/339) — `recipe-shopping-sheet.tsx`: gespiegelte UI-Änderungen

### Checkpoint: Delivery
- [x] Betroffene Screen-/Sheet-Tests grün, `bun run typecheck`, `bun run check`

Nachträglich während der Umsetzung gefunden (nicht im ursprünglichen
Scope, aber direkt im selben Übertragsflow):
- [x] [fam-nlj](https://github.com/goldjunge91/fam/issues/342) — Bulk-Aktion "Allen einen Markt zuweisen"
- [x] [fam-7g5](https://github.com/goldjunge91/fam/issues/343) — Übernehmen-Button: ganze Übertragsdauer sperren
- [x] [fam-a6z](https://github.com/goldjunge91/fam/issues/344) — Sync-Banner nicht mehr bei erfolgreichem Online-Sync anzeigen

### Checkpoint: Nachträge
- [x] Alle betroffenen Tests grün, `bun run typecheck`, `bun run check`
- [x] PR [#345](https://github.com/goldjunge91/fam/pull/345) — CI grün (Typecheck, Biome, Unit-Tests, DB/RLS, GitGuardian), gemerged (Squash) in `main` (`26bca48`)

Zurückgestellt, eigener Task, noch nicht spezifiziert:
- [ ] [fam-lr0](https://github.com/goldjunge91/fam/issues/346) — Doppelzählung bei Mehrfachnutzung desselben Gerichts — **blockiert auf Entscheidung**, drei Lösungsvarianten als Mockup vorbereitet (siehe Open Questions unten)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Domänenlogik-Änderung (Filter entfernen) läuft vor UI-Anpassung in Produktion | Med — gedeckte Artikel würden vorausgewählt in den Screens auftauchen, bevor die UI dafür bereit ist | Foundation- und Delivery-Tasks im selben PR/Branch gehalten, nicht separat deployed |
| Sortierung verschiebt sich, echte Lücken werden von gedeckten Artikeln verdrängt | Low | `computeMissingIngredients` sortiert weiterhin absteigend nach `missingGrams` — Lücken bleiben oben |
| `RowStorePicker`s anchored-Dropdown (`measureInWindow`) nicht mit RNTL end-to-end testbar | Low, aber echte Testlücke | Als eigenes Issue [#341](https://github.com/goldjunge91/fam/issues/341) dokumentiert statt stillschweigend ungetestet gelassen |
| `.mcp.json` enthielt beim ersten Push ein Klartext-Bearer-Token | High (Secret-Leak) | Vor dem Push erkannt, Datei zurückgehalten bis der Token lokal entfernt war, erst danach committet |

## Open Questions

- **Doppelzählung ([fam-lr0](https://github.com/goldjunge91/fam/issues/346)):**
  Wenn dasselbe Gericht mehrfach im Wochenplan steht und für einen
  früheren Eintrag bereits ein Übertrag stattfand, rechnet
  `computeMissingIngredients` nur gegen den physischen Vorrat, nicht
  gegen die bereits ungecheckt auf der Einkaufsliste stehende Menge —
  ein erneuter Übertrag addiert zu viel. Drei Lösungsvarianten als
  Mockup vorbereitet
  ([Artefakt](https://claude.ai/code/artifact/03a28d73-62dd-436c-aa4d-a0871b46345c)):
  Verrechnen (Vorrat + Liste als "verfügbar"), Nur Warnhinweis,
  Ersetzen statt Addieren. Entscheidung durch Marco steht noch aus.
- **"Vorwoche übernehmen" hat keinen Duplikat-Schutz** — bewusst
  außerhalb dieses Scopes belassen, der Button wird separat
  überarbeitet (kein Issue-Task hierzu, nur in der Spec vermerkt).
