# Capability Map: Inventory Design Consistency

**Status:** Review erforderlich (Phase 0)  
**Version:** 0.1  
**Stand:** 2026-09-14  
**Bezug:** `fam-o0qr`, `CONSTRAINTS.md`, `docs/design-system/contracts/07-buttons-and-interaction.md`, `docs/design-system/contracts/10-accessibility-and-states.md`

## Ziel

Diese Initiative beschreibt drei beobachtete UI-Korrekturen im Inventory. Ziel
ist ein Vorrat, dessen Statuszahlen semantisch korrekt sind, den sichtbaren
Listen-Kontext nicht widersprechen und dessen Formularaktionen auf dem Gerät
verlässlich erreichbar bleiben.

Die Map legt nur die Modulgrenzen, Owner und Reihenfolge fest. Sie ändert noch
keinen Produktionscode und ersetzt weder den Inventory-Operationsvertrag noch
die bestehende Haushalts-Inventar-Capability-Map.

## Scope-Gate

Die Anforderungen sind unabhängig testbar und haben unterschiedliche Owner-
Grenzen:

- Statusklassifikation und sichtbare Benennung können mit Datums-Fixtures geprüft
  werden.
- Kennzahlen-Scope und Lagerortfilter können mit mehreren Lagerorten geprüft
  werden.
- Touchflächen können nur über native Device-Evidence geprüft werden.

Deshalb werden sie vor den einzelnen Modul-Specs explizit geschnitten.

## Capability-Map

| Modul-ID | Verantwortung | Primärer Owner | Abhängigkeiten |
|---|---|---|---|
| `expiry-status-semantics` | Trennung von abgelaufen, kritisch und bald fällig in Statuswerten, Labels und zugänglicher Zusammenfassung | `src/features/inventory/expiry.ts`, `src/features/inventory/components/inventory-summary-card.tsx` | keine |
| `inventory-summary-scope` | Konsistenter Bezug der Statuskennzahlen zum aktiven Lagerort und zur sichtbaren Vorratsansicht | `src/features/inventory/inventory-screen.tsx` | `expiry-status-semantics` |
| `inventory-form-touch-targets` | Erreichbare Touchflächen für Inline-Aktionen im Add-Item-Formular | `src/features/inventory/add-item-screen.tsx` plus bestehende UI-Verträge | keine |

## Build-Reihenfolge

```text
expiry-status-semantics
        |
        +--> inventory-summary-scope

inventory-form-touch-targets  (parallel möglich)
```

`inventory-summary-scope` verwendet die Statusbedeutungen aus
`expiry-status-semantics` und wird deshalb danach spezifiziert. Die Formular-
Touchflächen sind fachlich unabhängig und können parallel spezifiziert werden.

## Evidence-Basis

- iOS Dev-Client `com.goldjunge91.fam1`, Device-Snapshot/Screenshot, 440 × 956.
- Die Summary zeigte `6 Artikel laufen bald ab`, während sichtbare Zeilen
  `seit 12 Tagen abgelaufen`, `seit 11 Tagen abgelaufen`, `seit 9 Tagen
  abgelaufen` und `seit 4 Tagen abgelaufen` meldeten.
- Nach Auswahl von `Kühlschrank` blieben `6 / 0 / 31` in der Summary bestehen,
  obwohl die Liste auf drei Kühlschrank-Artikel reduziert war.
- Der Device-Tree maß im Add-Item-Formular `+ Neuer Lagerort` mit
  `138,7 × 23 pt` und `Weitere Angaben öffnen` mit `390 × 36 pt`.
- Source-Beleg für die Statusaggregation:
  `src/features/inventory/inventory-screen.tsx` und `src/features/inventory/expiry.ts`.
- Source-Beleg für die Touchflächen:
  `src/features/inventory/add-item-screen.tsx`.

## Gemeinsame Grenzen

### Immer

- Fachliche Statusbedeutungen bleiben zentral in `expiry.ts`; Komponenten
  interpretieren sie nicht erneut.
- Summary-Zahlen und zugängliche Labels müssen dieselbe fachliche Quelle und
  denselben ausdrücklich benannten Scope verwenden.
- Interaktive Controls erfüllen mindestens `44 × 44` logische Einheiten realer
  Touchfläche; große Schrift und lange Labels dürfen die Fläche vergrößern.
- Änderungen verwenden `react-native-unistyles`, bestehende UI-Primitiven und
  die vorhandenen Owner. Keine neue globale Style- oder Farbquelle.
- Fokussierte Tests und iOS-Device-Evidence prüfen beobachtbare Wirkung.

### Vorher klären

- Sollen die Statuskarten beim Lagerortwechsel den aktiven Lagerort zählen oder
  bewusst den gesamten Haushalt? Die empfohlene Spec-Annahme ist: aktiver
  Lagerort, mit sichtbarer Scope-Benennung.
- Soll `expired` als eigene Karte erscheinen oder unter einem neutralen Label
  wie `Kritisch` zusammengefasst werden? Die empfohlene Annahme ist eine
  explizite Trennung von `Abgelaufen` und `Läuft bald ab`, falls der Screen ohne
  zusätzliche Interaktion beide Informationen zeigen kann.
- Für den Add-Item-Screen ist zu entscheiden, ob die Inline-Aktionen nur durch
  zusätzliche vertikale Fläche oder durch ein bestehendes Button-/Press-Rezept
  auf 44 × 44 gebracht werden.

### Niemals

- Keine neue parallele Ablaufklassifikation oder zweite Kennzahlenberechnung.
- Keine rein farbliche Statuskorrektur ohne verständliches sichtbares Label.
- Keine Koordinaten- oder Screenshot-Assertions als Ersatz für Verhaltenstests.
- Keine Änderung an Datenbank, Sync, Outbox oder Supabase-Schema für diese
  reine UI-/Semantik-Initiative.
- Keine Implementierung, bevor diese Capability Map und danach die jeweiligen
  Modul-Specs geprüft und freigegeben sind.

## Vorgesehene Modul-Specs nach Freigabe

1. `SPEC-expiry-status-semantics.md`
2. `SPEC-inventory-summary-scope.md`
3. `SPEC-inventory-form-touch-targets.md`

Jede Modul-Spec enthält Objective, Kommandos, Projektstruktur, Code-Stil,
Teststrategie, Grenzen, konkrete Success Criteria und offene Fragen.
