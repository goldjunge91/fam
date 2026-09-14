# Implementation Plan: `SectionHeading` konsolidieren

Status: Zur Umsetzung vorbereitet · 2026-09-14

Beads-Epic: `fam-hb0j`

Die Arbeitspakete werden ausschließlich in Beads geführt. `tasks/todo.md` wird
nicht angelegt. Der bestehende `tasks/plan.md` zur abgeschlossenen Unistyles-
Migration bleibt unverändert.

## Overview

`SectionHeading` existiert derzeit zweimal: als semantisches Primitive in
`src/constants/ui.tsx` und als unabhängige Layout-Komponente in
`src/components/layout/section-heading.tsx`. Die zweite Implementierung wird
in den drei Recipe-Bereichen verwendet, während Showcase und UI-Tests bereits
den zentralen Owner verwenden.

Ziel ist genau eine kanonische Implementierung in `src/constants/ui.tsx`.
Die Migration erhält die aktuelle Recipe-Hierarchie und die bestehende
Funktion optionaler Aktionen. Sie umfasst weder Datenbank, Sync, Navigation
noch neue Native-Dependencies.

## Architecture Decisions

- `src/constants/ui.tsx` bleibt gemäß `AGENTS.md` und den Design-System-Verträgen
  der einzige Owner für das semantische Primitive.
- Die öffentliche API verwendet `title`, `eyebrow`, `titleVariant`, `action`,
  `onAction` und `style`. Die bisherigen Namen `actionLabel` und
  `onActionPress` werden nicht über einen dauerhaften Adapter weitergeführt.
- Der kanonische Default bleibt `titleVariant="heading"`, passend zum aktiven
  Typografie-Vertrag. Recipe-Consumer, die bisher implizit die Layout-Variante
  mit `body` nutzten, setzen `titleVariant="body"` explizit. Damit bleibt ihr
  sichtbares Verhalten erhalten.
- Abschnittsaktion und Pressed-/Reduced-Motion-Verhalten laufen über `Press` aus
  `ui.tsx`. Die statische Fläche, native Accessibility-Metadaten und der
  wirksame Touchbereich gehören zum zentralen Vertrag.
- Lokale Consumer dürfen nur Kompositions- und Layout-Overrides über `style`
  liefern. Semantische Farben, Typografie und Interaktionszustände bleiben im
  Owner.
- Vor einer tatsächlichen Layout- oder Copy-Änderung wird die bestehende
  Repository-Regel für mehrere statische UI-Mocks beachtet. Die Konsolidierung
  soll primär Verhalten und Darstellung erhalten, nicht das Screen-Design
  neu gestalten.

## Dependency Graph

```text
fam-hb0j.1 Vertrag und zentraler Owner
        ↓
fam-hb0j.3 Recipe-Consumer migrieren und Duplikat entfernen
        ↓
fam-hb0j.2 Ownership-Gate und native Abnahme
```

## Task List

### Phase 1: Vertrag und Primitive

1. `fam-hb0j.1` · Kanonischen `SectionHeading`-Vertrag in `ui.tsx` festlegen

   **Beschreibung:** Die zentrale Primitive erhält die benötigten Eigenschaften
   der Layout-Variante, ohne eine zweite Implementierung oder einen dauerhaften
   Prop-Adapter einzuführen.

   **Akzeptanzkriterien:**

   - [ ] `ui.tsx` besitzt `eyebrow`, `titleVariant`, optionale Aktion und
         lokales Style-Override.
   - [ ] Die Standardvariante ist `heading`; bisherige Recipe-Defaults werden
         später an den betroffenen Consumern explizit als `body` gesetzt.
   - [ ] Die Aktion rendert nur als echte Aktion mit gültigem Callback,
         `accessibilityRole="button"`, zugänglichem Namen und wirksamem
         Touchbereich.
   - [ ] Titel, Eyebrow, lange Titel, Action-Callback und Style-Merge sind in
         fokussierten Tests abgedeckt.
   - [ ] Der aktive Screen-/Accessibility-Vertrag benennt Owner, API und
         Verhalten.

   **Verifikation:**

   - [ ] `bun run test src/constants/ui.test.tsx --watchman=false --runInBand`
   - [ ] `bun run check`
   - [ ] `bun run typecheck`

   **Abhängigkeiten:** Keine.

   **Voraussichtlich betroffene Dateien:**

   - `src/constants/ui.tsx`
   - `src/constants/ui.test.tsx`
   - `docs/design-system/contracts/09-screens-and-navigation.md`
   - `docs/design-system/contracts/10-accessibility-and-states.md`

   **Umfang:** Medium, vier Dateien.

### Phase 2: Consumer-Migration

2. `fam-hb0j.3` · Recipe-Consumer auf kanonisches `SectionHeading` migrieren

   **Beschreibung:** Die Recipe-Filter, der Recipe-Screen und der Recipe-Katalog
   importieren den zentralen Owner. Die bisher implizite `body`-Darstellung wird
   dort explizit gemacht, während die bereits explizite `heading`-Variante
   erhalten bleibt. Danach wird die unabhängige Layout-Datei entfernt.

   **Akzeptanzkriterien:**

   - [ ] Kein Production-Consumer importiert mehr aus
         `components/layout/section-heading`.
   - [ ] Es existiert genau eine produktive `SectionHeading`-Definition.
   - [ ] Filterbereiche, Recipe-Abschnitte und Katalogkopf behalten ihre
         bisherige Typografie, Abstände und Hierarchie.
   - [ ] Alle vorhandenen Abschnittsaktionen behalten Callback, zugänglichen
         Namen und Touch-Verhalten.

   **Verifikation:**

   - [ ] Betroffene fokussierte Recipe-/UI-Tests bestehen.
   - [ ] `rg`- und Architektur-Scan finden keinen alten Import oder zweite
         Definition.
   - [ ] `bun run check`
   - [ ] `bun run typecheck`

   **Abhängigkeiten:** `fam-hb0j.1`.

   **Voraussichtlich betroffene Dateien:**

   - `src/features/recipes/components/recipe-filter-modal.tsx`
   - `src/features/recipes/screens/recipes-screen.tsx`
   - `src/features/recipes/catalog/recipe-catalog-screen.tsx`
   - `src/components/layout/section-heading.tsx`

   **Umfang:** Medium, vier Dateien.

### Checkpoint: Nach Phase 2

- [ ] Zentrale Primitive und alle Recipe-Consumer verwenden denselben Vertrag.
- [ ] Die alte Layout-Datei ist entfernt.
- [ ] UI-Tests, Biome und Typecheck sind grün.
- [ ] Vor einer nativen Stichprobe ist geklärt, ob die bestehende Darstellung
      ohne visuelle Änderung erhalten wurde.

### Phase 3: Regression-Gate und native Abnahme

3. `fam-hb0j.2` · Ownership-Gate und native Abnahme ergänzen

   **Beschreibung:** Die Konsolidierung wird dauerhaft gegen erneute Duplikation
   abgesichert und auf realen Plattformen geprüft. Das Gate prüft die
   Importgrenze syntaktisch; die Geräteprüfung belegt das Verhalten, das Jest
   bei dynamischen Pressable-Styles nicht zuverlässig beweist.

   **Akzeptanzkriterien:**

   - [ ] Ein Convention-Test schlägt bei einer zweiten produktiven Definition
         oder beim alten Layout-Import fehl.
   - [ ] Light/Dark, schmale Breite, große Schrift und lange Titel bleiben
         lesbar und erreichbar.
   - [ ] iOS und Android zeigen die sichtbare Press-Fläche, korrekte Aktion,
         wirksamen Touchbereich und Reduced-Motion-kompatibles Feedback.
   - [ ] Es gibt keine Änderungen an Datenbank, Sync, Native-Dependencies oder
         allgemeiner Navigation.

   **Verifikation:**

   - [ ] `bun run test test/conventions/section-heading-convention.test.ts --watchman=false --runInBand`
   - [ ] Betroffene UI-/Recipe-Tests
   - [ ] `bun run check`
   - [ ] `bun run typecheck`
   - [ ] Dokumentierte iOS-/Android-Dev-Client-Stichprobe
   - [ ] Abschlussreview in den fünf Achsen: Korrektheit, Lesbarkeit,
         Architektur, Accessibility/Sicherheit und Performance

   **Abhängigkeiten:** `fam-hb0j.3`.

   **Voraussichtlich betroffene Dateien:**

   - `test/conventions/section-heading-convention.test.ts`
   - Beads-Abschlussnachweis für Runtime- und Review-Evidenz

   **Umfang:** Small, eine Testdatei plus manuelle Verifikation.

## Risks and Mitigations

| Risiko | Auswirkung | Mitigation |
| --- | --- | --- |
| Die beiden Varianten unterscheiden sich bei Default-Typografie oder Abstand | Mittel | Recipe-Defaults explizit als `body` setzen und vor der Migration anhand der bestehenden Referenz prüfen |
| Action-Pressed-Feedback bleibt nur in Jest sichtbar | Hoch | `Press` mit statischem Style verwenden und echte iOS-/Android-Stichprobe verlangen |
| Accessibility des bisherigen Layout-Pressables wird versehentlich verschlechtert | Hoch | Native Rolle, Label und Touchbereich als Test- und Abnahmekriterium festlegen |
| Ein späterer Consumer führt die entfernte Layout-Quelle wieder ein | Mittel | Syntaktisches Ownership-Gate als Regression-Schranke ergänzen |
| Die große zentrale Datei wächst weiter | Niedrig | Kein neuer Owner, keine neue Abstraktionsschicht; Scope auf bestehendes Primitive begrenzen |

## Open Questions

- Keine fachliche Blockade. Die Umsetzung setzt voraus, dass die bestehende
  Recipe-Darstellung Vorrang vor der bisherigen impliziten Default-API hat.
- Die Geräteabnahme benötigt einen verfügbaren iOS- und Android-Dev-Client;
  falls eine Plattform nicht verfügbar ist, bleibt ihr Nachweis offen und wird
  nicht durch Jest ersetzt.

## Completion Gate

- [ ] Beads `fam-hb0j.1`, `fam-hb0j.3` und `fam-hb0j.2` geschlossen.
- [ ] Genau ein produktiver Owner und kein alter Import.
- [ ] Fokussierte Tests, Biome und Typecheck grün.
- [ ] Native Nachweise für Pressed-State, Touchbereich, Accessibility und große
      Schrift dokumentiert.
- [ ] Arbeitsbaum und Diff geprüft; keine fachfremden Änderungen enthalten.
