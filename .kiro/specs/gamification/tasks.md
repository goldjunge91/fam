# Implementation Plan: gamification

## Overview

Dieser Plan zerlegt Release 1 in abhängige TypeScript-, SQL- und Testschritte. Er deckt Source Evidence, Local-first-Sync, Projektionen, UI und Release-Gates ab.

## Scope und feste Grenzen

- Diese Phase erstellt nur diese Task-Datei.
- `requirements.md` bleibt unverändert und strikt schreibgeschützt.
- Die Umsetzung verwendet TypeScript, Bun, Expo, React Native, Supabase, Postgres und Drizzle.
- Source Domain-Ergebnisse bleiben bei Gamification-Fehlern erhalten.
- Keine App-Öffnung, Navigation, Telemetrie oder lokale UI-Aktion erzeugt Gamification-Fortschritt.
- Release 1 umfasst genau sechs Source Types.
- Neue UI nutzt nur `react-native-unistyles` v3 und bestehende UI-Owner.
- Supabase-Schemaänderungen erfolgen nur in `supabase/schemas/*.sql`.
- Migrationen entstehen mit `bun run db:diff`.
- Lokale Schemaabnahmen nutzen `bun run db:reset` und `bun run db:types`.
- Generierte Migrationen und `src/lib/database.types.ts` werden nicht manuell editiert.
- Privilegierte Serverpfade nutzen Secret API Keys über kontrollierte Serverumgebungen.
- `SUPABASE_SERVICE_ROLE_KEY` darf nicht verwendet werden.
- Tests laufen gezielt mit `bun run test <datei>` oder `bun run test:db <datei>`.
- `bun test` und die vollständige Testsuite bleiben ausgeschlossen.
- Aufgaben mit `*` sind optionale Testaufgaben nach dem Fast-Task-Vertrag.
- Produktcode entsteht erst bei der späteren Umsetzung, nicht während dieser Workflow-Phase.

## Tasks

- [ ] 1. Gemeinsame Source- und Operation-Verträge implementieren
  - Dieser Schritt schafft die gemeinsame Typ- und Validierungsbasis für alle sechs Source Domains.
  - **Voraussetzung:** keine.
  - **Parallelisierbarkeit:** 1.1 ist die Basis für alle weiteren Implementierungsschritte. 1.2 folgt danach.
  - **Risiko:** Uneinheitliche IDs oder Scope-Prüfungen erzeugen später doppelte Projektionen.

  - [ ] 1.1 Source Types, Logical Source Keys und Operationen als TypeScript-Vertrag anlegen
    - Lege die sechs erlaubten `GamificationSourceType`-Werte und ihre Scope-Matrix fest.
    - Lege `complete`, `reverse` und `restore` als einzige Source-Aktionen fest.
    - Definiere `GamificationOperation`, `AcceptedOutcome`, Participation-Referenzen und Payload-Digest.
    - Erzeuge Logical Source Keys aus Scope, Scope-ID, Source Type und Completion ID.
    - Validere Scope, Owner, Source Type, IDs, Zeitstempel und erlaubte Gegenwege.
    - Erzeuge Operation IDs vor dem ersten lokalen Versuch und bewahre Payloads bei Retries unverändert.
    - Lehne ausgeschlossene Quellen und falsche Scope-Kombinationen vor jeder Projektion ab.
    - **Akzeptanz:** Jeder gültige Vertrag hat stabile IDs, einen eindeutigen Logical Source Key und eine prüfbare Aktion.
    - **Verifikation:** Fokussierter Domain-Test, Typecheck und Biome zeigen keine direkte Ableitung in XP oder Streak-Code.
    - **Dateien:** `src/features/gamification/domain/`, zugehörige fokussierte Tests.
    - **Requirements:** 1.1–1.17, 1.18–1.21, 21.1–21.19, 22.1–22.7.
    - **Abhängigkeit:** keine.

  - [ ]* 1.2 **Property 1: Source-Identität und Operation-Idempotenz** als reinen Domain-Test implementieren
    - Prüfe mindestens 100 Iterationen mit gültigen Completion-, Reversal- und Restoration-Operationen.
    - Prüfe, dass Retries dieselbe Payload, Completion ID, Logical Source Key und akzeptierte Wirkung behalten.
    - Prüfe, dass eine abweichende Payload mit derselben Operation ID dauerhaft fehlschlägt.
    - Prüfe alle sechs Source Types, ihre Scope-Grenzen und neue IDs für fachlich neue Vorgänge.
    - **Property:** „For all valid source operations, retrying the same operation preserves its payload, Logical Source Key, and accepted state.“
    - **Validiert:** Design Property 1; Requirements 1.1–1.7, 1.11–1.13, 2.1–2.16, 3.1–3.17, 4.1–4.17, 5.1–5.18, 6.1–6.19, 7.1–7.23, 21.8–21.15.
    - **Verifikation:** `bun run test <fokussierter-domain-test>` mit mindestens 100 Iterationen.
    - **Abhängigkeit:** 1.1.

- [ ] 2. Durable Cooking Sessions und ihren Gegenweg implementieren
  - Der Cooking-Adapter ersetzt React-State und Recipe-ID-Refs durch dauerhafte fachliche Evidence.
  - **Voraussetzung:** Task 1.1.
  - **Parallelisierbarkeit:** Kann nach Task 1 parallel zu Tasks 3 bis 7 bearbeitet werden.
  - **Risiko:** Ein Finished Screen ohne persistierte Evidence darf keinen Abschluss erzeugen.

  - [ ] 2.1 Cooking Session, Completion Evidence, Reopen und Re-complete verdrahten
    - Erzeuge die Cooking Session ID beim Start und bewahre sie über Remounts und Retries.
    - Speichere die finale Evidence vor dem Gamification-Command.
    - Nutze `cooking_session_completed`, den aktiven Household Scope und den expliziten Abschlusszeitpunkt.
    - Klassifiziere Öffnen, Remount, Schrittwechsel, Background-Rückkehr und Finished Screen ohne Evidence als Nichtabschluss.
    - Implementiere Reopen als Reversal und erneute vollständige Fertigstellung als Restoration derselben Quelle.
    - Ersetze den direkten `recordActivity()`-Aufruf im Cooking Mode durch den Source Command.
    - **Akzeptanz:** Zwei Geräte und beliebige Retries behalten dieselbe Cooking Session ID und erzeugen einen logischen Outcome.
    - **Verifikation:** Completion, Reversal, Restoration, Retry, neuer späterer Kochvorgang und fehlende Evidence werden gezielt geprüft.
    - **Dateien:** `src/features/recipes/screens/cooking-mode-screen.tsx`, Cooking-Session-Domain und passende persistente Source-Evidence-Dateien.
    - **Requirements:** 2.1–2.17, 1.4–1.7, 1.11–1.17.
    - **Abhängigkeit:** 1.1.

  - [ ]* 2.2 Cooking-Session-Beispiele und Gegenweg testen
    - Prüfe expliziten finalen Schritt, Reopen, Re-complete, Retry und parallele Geräte.
    - Prüfe, dass UI-Öffnungen, Remounts, Schritte und Finished Screens ohne Evidence keine Projektion erzeugen.
    - Prüfe, dass eine spätere Recipe-Nutzung eine neue Session ID verwendet.
    - **Verifikation:** `bun run test <Cooking-Session-Testdatei>`.
    - **Requirements:** 2.7–2.16, 21.6–21.15, 22.1–22.6.
    - **Abhängigkeit:** 2.1.

- [ ] 3. Durable Shopping Runs und ihren Gegenweg implementieren
  - Der Shopping-Adapter erhält eine stabile Run-Grenze vor dem ersten atomaren Transfer.
  - **Voraussetzung:** Task 1.1.
  - **Parallelisierbarkeit:** Kann nach Task 1 parallel zu Tasks 2 und 4 bis 7 bearbeitet werden.
  - **Risiko:** Item-Historien dürfen fehlende Run-Evidence nicht ersetzen.

  - [ ] 3.1 Shopping Run ID, Transfer-Evidence und Korrekturpfad implementieren
    - Erzeuge die Shopping Run ID vor dem ersten Transfer-Versuch.
    - Bewahre die ID über alle Transfer-Legs und Source-Evidence-Zeilen.
    - Aktiviere nur nach einem erfolgreichen atomaren, nichtleeren Transfer mit mindestens einem Inventory Item.
    - Klassifiziere Prüfen, Sheet-Öffnung, Abbruch, leere Runs und Rollbacks als Nichtabschluss.
    - Implementiere Reversal bei fachlicher Korrektur und Restoration bei erneut gültigem Transfer.
    - Entferne den direkten Streak-Aufruf nach dem lokalen Commit und verwende den Source Command.
    - Rekonstruiere keine Runs aus `shopping_history`.
    - **Akzeptanz:** Ein Run hat genau eine logische Quelle, auch nach Lost-Response-Retry und mehreren Geräten.
    - **Verifikation:** Atomizität, Run-ID-Persistenz, Reversal, Restoration und Ausschlüsse werden gezielt geprüft.
    - **Dateien:** `src/features/shopping-list/hooks/use-complete-shopping-run.ts`, Shopping-Run-Domain und persistente Evidence-Dateien.
    - **Requirements:** 3.1–3.17, 1.3, 1.11–1.17, 21.18.
    - **Abhängigkeit:** 1.1.

  - [ ]* 3.2 Shopping-Run-Beispiele und Gegenweg testen
    - Prüfe nichtleeren erfolgreichen Transfer, leeren Run, Rollback, Retry, Korrektur und Redo.
    - Prüfe, dass Item-Level-Historien, Checkboxes und Sheet-Öffnung keinen Outcome erzeugen.
    - Prüfe eine spätere Shopping Session mit neuer Run ID.
    - **Verifikation:** `bun run test <Shopping-Run-Testdatei>`.
    - **Requirements:** 3.7–3.16, 21.6–21.12, 21.18.
    - **Abhängigkeit:** 3.1.

- [ ] 4. Autoritative Meal-Plan-Abschlüsse implementieren
  - Der Meal Plan erhält eine serverautoritativ vergebene Completion ID pro Household, Plan und Woche.
  - **Voraussetzung:** Task 1.1.
  - **Parallelisierbarkeit:** Kann nach Task 1 parallel zu Tasks 2, 3 und 5 bis 7 bearbeitet werden.
  - **Risiko:** Entry-Telemetrie darf nicht als Planabschluss verwendet werden.

  - [ ] 4.1 Completion-ID, Complete, Reopen und Re-complete in den Meal-Plan-Vertrag integrieren
    - Ergänze serverautoritatives Completion State, Completion ID, Zeitpunkt und Eindeutigkeit für Household, Plan und Woche.
    - Führe eine explizite Complete-Aktion mit mindestens einem aktiven Eintrag ein.
    - Verlange Reopen vor Änderungen an einem abgeschlossenen Plan.
    - Implementiere Reopen als Reversal und erneuten Abschluss als Restoration derselben Quelle.
    - Lehne leere Pläne, Entry-Edits, Entry-Saves, Copy und Week Expiry als Nichtabschluss ab.
    - Ignoriere `meal_plan_entry.create.completed` als Source Evidence.
    - **Akzeptanz:** Zwei Geräte können dieselbe Woche abschließen, erhalten aber dieselbe Completion ID und denselben Logical Source Key.
    - **Verifikation:** Server-Serialisierung, ID-Wiederverwendung und Reopen-Gegenweg werden gezielt geprüft.
    - **Dateien:** `supabase/schemas/14_meal_plans.sql`, `src/features/meal-planner/use-meal-plans.ts`, Meal-Plan-Command und fokussierte Tests.
    - **Requirements:** 4.1–4.17, 1.3, 1.8–1.13, 21.15.
    - **Abhängigkeit:** 1.1.

  - [ ]* 4.2 Meal-Plan-Abschluss und Telemetrie-Ausschluss testen
    - Prüfe einen Plan mit einem aktiven Eintrag, leere Pläne, Entry-Saves, Copy, Ablauf und parallele Complete-Aufrufe.
    - Prüfe Reopen, Re-complete, Retry und Payload-Idempotenz.
    - Prüfe, dass Entry-Telemetrie keinen Outcome erzeugt.
    - **Verifikation:** `bun run test:db <Meal-Plan-pgTAP-Test>` und `bun run test <Meal-Plan-Testdatei>`.
    - **Requirements:** 4.7–4.17, 21.15, 22.1–22.4.
    - **Abhängigkeit:** 4.1.

- [ ] 5. Fachlichen Inventory-Consume-Vertrag implementieren
  - Der Inventory-Pfad unterscheidet echten Verbrauch von Löschung, Korrektur und anderen negativen Bewegungen.
  - **Voraussetzung:** Task 1.1.
  - **Parallelisierbarkeit:** Kann nach Task 1 parallel zu Tasks 2 bis 4 und 6 bis 7 bearbeitet werden.
  - **Risiko:** Ein generisches `out` erzeugt falsche Rewards bei Korrekturen.

  - [ ] 5.1 `consume`-Reason, Consume Operation ID, Undo und Redo verdrahten
    - Erzeuge die Consume Operation ID vor der Mengenänderung.
    - Ergänze den fachlichen Reason `consume` im deklarativen Inventory-Vertrag.
    - Aktiviere nur positive Verbrauchsmengen nach erfolgreichem Inventory Commit.
    - Klassifiziere Delete, Waste, Move, Open, Inbound, Correction und andere Gründe als Nichtabschluss.
    - Implementiere Counterbook als Reversal und den exakten erneuten Verbrauch als Restoration.
    - Verhindere doppelte aktive Rewards aus Consume, Undo und Restore.
    - Bewahre Operation ID und Consume Operation ID über Retries.
    - **Akzeptanz:** Ein Verbrauchsvorgang behält über Retry, Undo und Redo eine logische Quelle.
    - **Verifikation:** Schema-, RPC- und Domain-Tests prüfen Reason, Mengen, Commit und Gegenwege.
    - **Dateien:** `supabase/schemas/08_inventory.sql`, Inventory-Domain und die aktuelle Consume-/Delete-UI.
    - **Requirements:** 5.1–5.18, 21.9–21.12.
    - **Abhängigkeit:** 1.1.

  - [ ]* 5.2 Inventory-Consume-Beispiele und negative Ausschlüsse testen
    - Prüfe positiven `consume`-Commit, fehlgeschlagenen Commit, Undo, Redo, Retry und parallele Geräte.
    - Prüfe `out` ohne `consume`, Delete, Waste, Move, Open, Inbound und Korrektur.
    - **Verifikation:** `bun run test:db <Inventory-pgTAP-Test>` und `bun run test <Inventory-Testdatei>`.
    - **Requirements:** 5.7–5.17, 21.1–21.5, 21.9–21.12.
    - **Abhängigkeit:** 5.1.

- [ ] 6. Atomare Recipe Publications implementieren
  - Der Recipe-Adapter erzeugt Evidence erst nach einem vollständigen finalen Save.
  - **Voraussetzung:** Task 1.1.
  - **Parallelisierbarkeit:** Kann nach Task 1 parallel zu Tasks 2 bis 5 und 7 bearbeitet werden.
  - **Risiko:** Root-first-Saves können Teilbeiträge fälschlich belohnen.

  - [ ] 6.1 Publication ID, vollständige Evidence, Withdraw und Restore verdrahten
    - Erzeuge die Recipe Publication ID vor dem ersten finalen Save-Versuch.
    - Prüfe Titel, aktive Component, gültiges aktives Item und aktiven Preparation Step.
    - Schreibe Root und abhängige Datensätze atomar als vollständige Publication Evidence.
    - Klassifiziere Root, Draft, Partial Failure, Preview, Edit und unveränderte Template-Kopie als Nichtabschluss.
    - Implementiere Delete oder Withdraw als Reversal und Restore oder Republish als Restoration.
    - Bewahre Publication ID und Operation ID über Retries und Geräte hinweg.
    - **Akzeptanz:** Ein vollständiger finaler Save erzeugt genau eine Publication-Quelle. Spätere Edits erzeugen keine zweite Quelle.
    - **Verifikation:** Atomische Save-, Failure-, Withdraw-, Restore- und Duplicate-Tests laufen über den bestehenden Recipe-Pfad.
    - **Dateien:** `src/features/recipes/screens/recipe-create-screen.tsx`, `src/features/recipes/hooks/use-recipes.ts`, Recipe-Domain und zugehörige Schemas.
    - **Requirements:** 6.1–6.19, 21.8, 21.10–21.12.
    - **Abhängigkeit:** 1.1.

  - [ ]* 6.2 Recipe-Publication-Beispiele und Teil-Save-Ausschlüsse testen
    - Prüfe vollständigen Save, Root-only, Draft, Preview, Child-Failure, Edit, Copy, Withdraw, Restore und Retry.
    - Prüfe gleiche Publication ID bei mehreren Geräten und neue IDs für neue Rezepte.
    - **Verifikation:** `bun run test <Recipe-Publication-Testdatei>`.
    - **Requirements:** 6.7–6.18, 21.8, 22.1–22.4.
    - **Abhängigkeit:** 6.1.

- [ ] 7. Private Meal Logs als Aggregate mit stabiler Identität implementieren
  - Das Meal Log wird zur privaten Aggregate-Grenze für vollständige Whole-Log-Saves.
  - **Voraussetzung:** Task 1.1.
  - **Parallelisierbarkeit:** Kann nach Task 1 parallel zu Tasks 2 bis 6 bearbeitet werden.
  - **Risiko:** Direkte Food-Entry-Writes würden den Offline-Vertrag weiterhin brechen.

  - [ ] 7.1 Meal-Log-Aggregat, Child-Ausschluss und Whole-Log-Command einführen
    - Erzeuge die Meal-Log-ID vor dem ersten lokalen Save.
    - Gruppiere alle Food Entries eines Logs unter derselben Meal-Log-ID.
    - Fordere mindestens eine aktive Position und einen erfolgreichen Whole-Log-Save.
    - Erzwinge `child_profile_id = null` für das gesamte Erwachsenen-Aggregat.
    - Halte `household_id` aus privaten Meal Logs heraus.
    - Klassifiziere Drafts, leere Logs, Einzel-Entry-Aktionen und Teil-Saves als Nichtabschluss.
    - Implementiere Delete als Reversal, Restore als Restoration und Edit ohne neue Source ID.
    - Bereite den direkten Food-Entry-API-Pfad für die spätere vollständige Local-first-Parität vor.
    - **Akzeptanz:** Nur ein vollständiger privater Whole-Log-Save erzeugt `private_meal_log_saved`.
    - **Verifikation:** Aggregate-, Child-, Scope-, Delete-, Restore- und Retry-Verträge werden gezielt geprüft.
    - **Dateien:** `supabase/schemas/09_tracking.sql`, `src/features/calorie-tracking/api.ts`, Tracking-Domain und Meal-Log-Modelle.
    - **Requirements:** 7.1–7.23, 21.4–21.5, 21.9, 21.13–21.14.
    - **Abhängigkeit:** 1.1.

  - [ ]* 7.2 Private-Meal-Log-Beispiele und Child-Ausschlüsse testen
    - Prüfe vollständigen Whole-Log-Save, leere Logs, Drafts, Einzel-Entry-Edits, Retry, Delete, Restore und mehrere Geräte.
    - Prüfe `child_profile_id`-Datensätze, `household_id`-Abwesenheit und fehlende Household-Projektionen.
    - **Verifikation:** `bun run test:db <Tracking-pgTAP-Test>` und `bun run test <Meal-Log-Testdatei>`.
    - **Requirements:** 7.7–7.23, 21.4–21.5, 21.9.
    - **Abhängigkeit:** 7.1.

- [ ] 8. Deklaratives Gamification-Schema, RLS und Privileges implementieren
  - Dieser Schritt bildet Datenbesitz, Operationen, Projektionen und Lebenszyklen im Backend ab.
  - **Voraussetzung:** Task 1.1 sowie die fachlichen Scope-Entscheidungen aus Tasks 2 bis 7.
  - **Parallelisierbarkeit:** 8.1 kann mit den Source-Prerequisites parallel laufen, sobald 1.1 abgeschlossen ist. 8.2 und 8.3 folgen seriell.
  - **Risiko:** Ein breites Tabellenrecht darf keine RLS-Lücke verdecken.

  - [ ] 8.1 Alle logischen Tabellenfamilien mit Constraints und Seeds deklarieren
    - Lege `source_definitions`, `source_evidence`, `source_operations` und `source_outcomes` an.
    - Lege Participation States, Participation Intervals und versionierte Timezones an.
    - Lege private Meal Logs, Contributions, XP, Achievements, Challenges, Active Days, Protection und Streaks an.
    - Lege Household Evidence, Outcome Events, Challenge Snapshots und Progress Weeks an.
    - Erzwinge Logical Source Key, erlaubte Source Types, Scope-Verträge, States und Revisionen.
    - Seed `source-outcome-xp` Version 1 und die drei Achievement Definitions unveränderlich.
    - Definiere kontrollierte Schreibpfade für Operationen und abgeleitete Zeilen.
    - Lege explizite Grants und RLS in `99_privileges.sql` sowie fachlich passenden Schema-Dateien an.
    - **Akzeptanz:** Jede synchronisierte Entity besitzt Ownership, Scope, Constraints, RLS-Grundlage und einen kontrollierten Schreibpfad.
    - **Verifikation:** SQL-Lint, lokaler Schema-Reset und Schema-Inspektion zeigen alle Familien und Unique Constraints.
    - **Dateien:** `supabase/schemas/*.sql`, insbesondere eine dedizierte Gamification-Schema-Datei und `99_privileges.sql`.
    - **Requirements:** 1.1–1.21, 9.1–9.18, 10.1–10.20, 11.1–11.27, 12.1–12.28, 13.1–13.14, 14.1–14.33, 15.1–15.25, 17.1–17.13, 18.1–18.22, 20.1–20.23.
    - **Abhängigkeit:** 1.1.

  - [ ] 8.2 Backend-Schema über die projektkonformen Generatoren abnehmen
    - Erzeuge die Migration ausschließlich mit `bun run db:diff`.
    - Setze die lokale Datenbank nur über `bun run db:reset` zurück.
    - Erzeuge `src/lib/database.types.ts` ausschließlich mit `bun run db:types`.
    - Prüfe, dass keine generierte Migration und kein generiertes Typartefakt manuell editiert wurde.
    - Prüfe `consume`, Meal-Plan-Completion und Source-Evidence-Spalten gegen den finalen lokalen Schemazustand.
    - **Akzeptanz:** Der lokale Supabase-Zustand und die generierten Typen entsprechen den deklarativen Schemas.
    - **Verifikation:** `bun run db:reset`, `bun run db:types`, gezielte Schema-Tests und `git diff --check`.
    - **Dateien:** Generierte Datenbankartefakte und die deklarativen Schemas aus 8.1.
    - **Requirements:** 5.1–5.7, 4.1–4.8, 17.1–17.13, 19.1–19.3, 22.8.
    - **Abhängigkeit:** 8.1.

  - [ ]* 8.3 **Property 16: RLS folgt Datenbesitz und Schreibgrenzen** mit pgTAP prüfen
    - Prüfe Account-RLS für private Outcomes, Contributions, XP, Achievements, Challenges, Streaks, Protection und Legacy.
    - Prüfe Household-RLS für Evidence, Outcome Events, Progress und Challenges.
    - Prüfe Member, Admin, Opt-out, Membership loss und fremde Accounts.
    - Prüfe direkte Client-Writes zu XP, Achievements, Challenge Progress, Revisions, Streaks und Protection.
    - Prüfe minimierte Household-Projektionen ohne Account IDs oder Raw Source Completion IDs.
    - **Property:** „For all authorized roles, Account rows require the own Account and Household projections require current membership and Participation.“
    - **Validiert:** Design Property 16; Requirements 17.1–17.13, 18.1–18.4, 18.9–18.12.
    - **Verifikation:** `bun run test:db <Gamification-RLS-pgTAP-Test>`.
    - **Abhängigkeit:** 8.2.

- [ ] 9. Lokalen Drizzle-Spiegel und Entity-Metadaten implementieren
  - Der lokale Store bildet alle synchronisierten Gamification-Entitys mit Account- und Household-Scope ab.
  - **Voraussetzung:** Tasks 1.1 und 8.1.
  - **Parallelisierbarkeit:** 9.1 folgt dem Backend-Schema. 9.2 und 9.3 folgen seriell.
  - **Risiko:** Fehlende Entity-Metadaten lassen Pull, Cursor oder Account-Isolation ausfallen.

  - [ ] 9.1 Drizzle-Schemas und lokale Migration für Gamification anlegen
    - Ergänze einen Drizzle-Spiegel für Source Evidence, Outcomes, Operations und Participation.
    - Ergänze Spiegel für Contributions, XP, Achievements, Challenges, Active Days, Protection, Streaks und Timezones.
    - Ergänze private Meal Logs und die erforderlichen Source-Referenzen.
    - Registriere die Tabellen im bestehenden Schema-Index.
    - Bewahre Account- und Household-Scope-Spalten für jede synchronisierte Entity.
    - Erzeuge die lokale Migration mit dem bestehenden Drizzle-Workflow, nicht mit handgeschriebenem SQL.
    - **Akzeptanz:** Jede synchronisierte Entity aus dem Backend hat eine lokale Tabelle und eine stabile Primär- oder Logical-Key-Abbildung.
    - **Verifikation:** Lokaler Reset, Migration, Schema-Registry und gezielte Insert-/Read-Tests.
    - **Dateien:** `src/lib/db/schemas/gamification.ts`, `src/lib/db/schemas/index.ts`, Drizzle-Migrationsverzeichnis.
    - **Requirements:** 19.1–19.3, 19.10–19.12, 19.24–19.27.
    - **Abhängigkeit:** 8.1.

  - [ ] 9.2 Entity-Union, Scope-Metadaten und Query-Invalidation registrieren
    - Ergänze `Entity` und `ENTITIES` für jede private und Household-scoped Gamification-Entity.
    - Definiere Pull-Reihenfolge, Cursor-Schlüssel und Membership-Filter nach bestehenden Sync-Konventionen.
    - Trenne private Account-Entitys von Household-Realtime-Channels.
    - Lege Query-Keys für jede geänderte Projection fest.
    - **Akzeptanz:** Kein Gamification-Datensatz bleibt außerhalb der Entity-Registry oder erhält einen falschen Scope.
    - **Verifikation:** Registry- und Cursor-Smoke-Tests prüfen Entity-Union, Scope und Invalidation-Keys.
    - **Dateien:** `src/lib/db/types.ts`, `src/lib/db/entities.ts`, `src/lib/sync/`-Metadaten und Query-Key-Dateien.
    - **Requirements:** 19.3, 19.6, 19.8, 19.23–19.27.
    - **Abhängigkeit:** 9.1.

  - [ ]* 9.3 Lokalen Spiegel und Schema-Registry testen
    - Prüfe Migration, Tabellen-Registry, Scope-Metadaten, Unique Keys und lokale Read-Isolation.
    - Prüfe, dass private Entitys nicht in Household-Listen oder Realtime-Payloads erscheinen.
    - **Verifikation:** `bun run test <Drizzle-Gamification-Testdatei>`.
    - **Requirements:** 19.1–19.3, 19.12, 19.24–19.25.
    - **Abhängigkeit:** 9.2.

- [ ] 10. Checkpoint: Source-, Backend- und Local-first-Grundlagen prüfen
  - **Akzeptanz:** Tasks 1 bis 9 sind implementiert. Die sechs Source Domains besitzen IDs, Evidence und Gegenwege.
  - **Verifikation:** Führe nur fokussierte Source-, pgTAP- und Drizzle-Tests aus. Führe zusätzlich `bun run typecheck` und `bun run check` aus.
  - **Risikoentscheidung:** Bei fehlender Source Evidence oder RLS darf kein Projection- oder UI-Schritt beginnen.
  - **Abhängigkeit:** 2.2, 3.2, 4.2, 5.2, 6.2, 7.2, 8.3 und 9.3.

- [ ] 11. Autoritative Commands, Participation und Zeitversionen implementieren
  - Dieser Schritt entscheidet serverseitig über Idempotenz, Revisionen, Participation und Domain Days.
  - **Voraussetzung:** Task 10.
  - **Parallelisierbarkeit:** 11.1 und 11.2 schreiben unterschiedliche Vertragsbereiche. Die Tests folgen beiden Implementierungen.
  - **Risiko:** Lokale Zeit oder Client-Ankunft darf keine autoritative Reihenfolge ersetzen.

  - [ ] 11.1 Server Command Boundary und Source-Revisionen implementieren
    - Implementiere einen kontrollierten authentifizierten Command-Pfad für Complete, Reverse und Restore.
    - Prüfe Auth, Membership, Participation Interval, Evidence, Scope, Source Type und Payload-Digest.
    - Sperre einen Logical Source Key während der Annahme.
    - Schreibe Operation Ledger, Current Outcome und Source Revision atomar.
    - Liefere gespeicherte Ergebnisse für identische Operation IDs zurück.
    - Lehne eine abweichende Payload mit derselben Operation ID dauerhaft ab.
    - Nutze keine direkten Client-Writes in abgeleitete Tabellen.
    - Halte Source Domain-Ergebnisse bei Command- oder Projection-Fehlern erhalten.
    - **Akzeptanz:** Jede angenommene Operation besitzt serverbestätigte Revision, Zustand und Operationsergebnis.
    - **Verifikation:** Command-Integrationstests prüfen Auth, Evidence, Membership, Idempotenz, Serialisierung und Fehlergrenzen.
    - **Dateien:** Kontrollierter RPC- oder Edge-Function-Pfad, Source-Command-Domain und zugehörige Server-Tests.
    - **Requirements:** 1.2–1.17, 17.8–17.10, 20.10–20.14, 22.1–22.6.
    - **Abhängigkeit:** 10.

  - [ ] 11.2 Participation States, Intervals und Timezone-Versionen implementieren
    - Initialisiere Personal Participation und jedes Account-Household-Paar mit `disabled`.
    - Erzeuge getrennte Operation IDs, Revisionen und Effective At-Werte für Personal und Household Participation.
    - Öffne und schließe bestätigte Intervalle nach serverseitiger Revisionsordnung.
    - Verlange gültige Account- und Household-Timezones vor dem ersten passenden Opt-in.
    - Speichere IANA-Identifier, Effective At und Timezone Revision.
    - Verwende Re-enable erst nach der wirksamen Disable-Revision.
    - **Akzeptanz:** Participation-Operationen beeinflussen nur ihren eigenen Schlüssel und konvergieren über serverbestätigte Revisionen.
    - **Verifikation:** Tests prüfen Enable, Disable, Re-enable, Offline-Reihenfolge, Effective At und Timezone-Versionierung.
    - **Dateien:** Participation- und Timezone-Domain, kontrollierter Command-Pfad und zugehörige Datenzugriffe.
    - **Requirements:** 1.18–1.21, 8.1–8.30, 20.1–20.9, 20.19–20.21.
    - **Abhängigkeit:** 11.1.

  - [ ]* 11.3 **Property 2: Serverrevision bestimmt den Outcome-Zustand** testen
    - Erzeuge mindestens 100 Operationsfolgen für einen Logical Source Key.
    - Liefere sie in unterschiedlicher Geräte- und Ankunftsreihenfolge an den Fold.
    - Prüfe, dass alle Geräte den Zustand mit der höchsten serverbestätigten Source Revision anzeigen.
    - **Property:** „For all operations for one Logical Source Key, every device converges to the state with the greatest server-confirmed Source Revision.“
    - **Validiert:** Design Property 2; Requirements 1.8–1.10, 19.18–19.19, 20.10–20.14.
    - **Verifikation:** `bun run test <Source-Revision-Testdatei>` mit mindestens 100 Iterationen.
    - **Abhängigkeit:** 11.2.

  - [ ]* 11.4 **Property 3: Participation bleibt pro Schlüssel getrennt** testen
    - Erzeuge mindestens 100 gemischte Personal- und Household-Participation-Operationen.
    - Prüfe getrennte Revisionen, Intervallgrenzen und Effective At-Werte.
    - Prüfe, dass ein Household-Opt-out keinen Personal-Intervallzustand verändert.
    - **Property:** „For all Personal and Household Participation keys, accepted revisions open or close only their own confirmed interval.“
    - **Validiert:** Design Property 3; Requirements 1.19–1.21, 8.1–8.4, 8.23–8.30, 19.29, 20.19–20.21.
    - **Verifikation:** `bun run test <Participation-Testdatei>` mit mindestens 100 Iterationen.
    - **Abhängigkeit:** 11.2.

  - [ ]* 11.5 **Property 4: Evidence und Participation begrenzen Projektionen** testen
    - Erzeuge gültige, ungültige und zeitlich außerhalb liegende Evidence.
    - Prüfe, dass nur Evidence innerhalb bestätigter Participation-Intervalle einen bestätigten Outcome erzeugt.
    - Prüfe Scope-Konflikte, falsche Membership, fehlende Evidence und Gamification-Fehler ohne Source-Rollback.
    - **Property:** „For all source records, only valid evidence inside a confirmed Participation Interval can create a confirmed projection.“
    - **Validiert:** Design Property 4; Requirements 1.14–1.17, 8.6–8.12, 20.7–20.9, 21.18–21.19, 22.1–22.6.
    - **Verifikation:** `bun run test <Evidence-Participation-Testdatei>` mit mindestens 100 Iterationen für den reinen Fold und gezielten Command-Beispielen.
    - **Abhängigkeit:** 11.2.

  - [ ]* 11.6 **Property 5: Source-Gegenwege behalten die logische Quelle** testen
    - Führe für alle sechs Source Types Completion, Reversal, Restoration, Edit und Retry in variabler Reihenfolge aus.
    - Prüfe genau eine logische Reward-Quelle und keine zweite aktive Wirkung.
    - Prüfe, dass ein neuer fachlicher Vorgang eine neue Completion ID erhält.
    - **Property:** „For all valid completion, reversal, restoration, edit, and retry sequences, one fachlicher Vorgang keeps one logical reward source.“
    - **Validiert:** Design Property 5; Requirements 2.11–2.15, 3.11–3.15, 4.10–4.15, 5.11–5.16, 6.12–6.17, 7.13–7.18, 21.10–21.15.
    - **Verifikation:** `bun run test <Source-Gegenweg-Testdatei>` mit mindestens 100 Iterationen für reine Sequenzfolds.
    - **Abhängigkeit:** 11.1 und Tasks 2.2 bis 7.2.

  - [ ]* 11.7 **Property 19: Zeitversionen halten historische Tage stabil** testen
    - Erzeuge Outcomes vor, während und nach Timezone-Revisionen.
    - Prüfe Domain Days anhand der zum `occurred_at` wirksamen IANA-Version.
    - Prüfe, dass spätere Timezone-Änderungen alte Domain Days nicht verschieben.
    - Prüfe Backdated- und Future-Day-Grenzen.
    - **Property:** „For all outcomes, the effective IANA timezone at `occurred_at` determines Domain Day and later timezone changes preserve prior days.“
    - **Validiert:** Design Property 19; Requirements 20.1–20.9.
    - **Verifikation:** `bun run test <Timezone-Testdatei>` mit mindestens 100 Iterationen für die reine Tagesberechnung.
    - **Abhängigkeit:** 11.2.

- [ ] 12. Outbox, Push, Pull, Realtime und Reconciliation implementieren
  - Dieser Schritt verbindet lokale Evidence mit dem autoritativen Backend und entfernt vorläufige Abweichungen.
  - **Voraussetzung:** Tasks 9, 10 und 11.
  - **Parallelisierbarkeit:** 12.1 und 12.2 sind getrennte Module. Die Konvergenztests folgen beiden.
  - **Risiko:** Realtime darf nie als alleinige Wahrheit dienen.

  - [ ] 12.1 Atomare Outbox-Mutationen, Push, Pull-Cursor und Realtime-Invalidation verdrahten
    - Schreibe Mirror-Zeilen und Outbox-Eintrag in einer lokalen exklusiven Transaktion.
    - Speichere Operation ID, Source Completion ID, Scope, Source Type und Aktion im Outbox-Payload.
    - Push Due-Outbox-Einträge idempotent über den Server Command Boundary.
    - Pull Account- und Household-scoped Rows mit dauerhaftem Cursor.
    - Vorrücke Cursor erst nach vollständigem Seiten-Commit.
    - Ergänze Meal Plans, Recipes, Food Entries und Gamification in Pull- und Realtime-Abdeckung.
    - Nutze Realtime ausschließlich für Invalidation und Pull-Anstoß.
    - Invalidiere alle betroffenen Projection Queries nach Push, Pull und Realtime-Hinweis.
    - **Akzeptanz:** Duplicate Outbox-Einträge erzeugen einen logischen Vorgang. Fehlende Realtime-Events werden durch Cursor-Pull korrigiert.
    - **Verifikation:** Outbox-, Cursor-, Retry-, Reconnect- und Query-Invalidation-Integrationstests.
    - **Dateien:** `src/lib/db/outbox.ts`, `src/lib/sync/push.ts`, `src/lib/sync/pull.ts`, `src/lib/sync/realtime.ts`, `supabase/schemas/90_realtime.sql`.
    - **Requirements:** 19.4–19.9, 19.18, 19.23–19.27, 19.29, 22.1–22.4.
    - **Abhängigkeit:** 9.2 und 11.1.

  - [ ] 12.2 Provisional-, Rejected- und Reconciliation-Fold implementieren
    - Erzeuge vorläufige Projektionen nur aus lokal verfügbaren Membership-, Participation- und Timezone-Daten.
    - Markiere unbestätigte Werte als `provisional`.
    - Lasse Reconciliation nur serverbestätigte Participation Revisionen und Intervalle zu.
    - Entferne rejected provisional progress, ohne Source Domain-Ergebnisse zu verändern.
    - Verarbeite Reversal vor Completion und Restoration vor stale Reversal deterministisch.
    - Friere Challenge-Snapshots nach Ende oder terminalem Freeze ein.
    - Mache Reconciliation wiederholbar und frei von zusätzlichen Grants, Unlocks, Days oder Challenge-Beiträgen.
    - **Akzeptanz:** Gleiche autoritative Eingaben erzeugen auf allen Geräten denselben Projection-Stand.
    - **Verifikation:** Deterministische Reconciliation- und Fehlerpfadtests mit fehlender, verspäteter und abgelehnter Evidence.
    - **Dateien:** Reconciliation-Domain, Pull-Anwendung und Projection-Adapter.
    - **Requirements:** 19.7–19.18, 20.10–20.18, 20.21–20.23, 22.1–22.6.
    - **Abhängigkeit:** 12.1 und 11.2.

  - [ ]* 12.3 **Property 18: Local-first-Operationen konvergieren** als Integrationsproperty testen
    - Erzeuge lokale gültige Mutationen mit atomarem Mirror- und Outbox-Write.
    - Simuliere Push, Seiten-Pull, Duplicate Operations, Realtime-Hinweis und Reconnect.
    - Prüfe einen identischen autoritativen Projection-Stand auf mehreren Geräten.
    - Prüfe Account- und Household-Scopes, Cursorfortschritt und Query-Invalidation.
    - **Property:** „For all locally valid mutations, atomic Mirror and Outbox writes plus successful Push and Pull cycles converge to one authoritative projection.“
    - **Validiert:** Design Property 18; Requirements 19.2–19.25, 19.29–19.32, 20.16–20.18.
    - **Verifikation:** `bun run test <Sync-Integration-Testdatei>` mit mindestens 100 Iterationen für den reinen Fold und gezielten Sync-Szenarien.
    - **Abhängigkeit:** 12.2.

  - [ ]* 12.4 **Property 21: Reconciliation ist wiederholbar und fehlertolerant** testen
    - Führe Reconciliation mehrfach mit derselben autoritativen Evidence und Projection aus.
    - Prüfe keine zusätzlichen Grants, Unlocks, Active Days oder Challenge-Beiträge.
    - Prüfe rejected operations, Reversal-vor-Completion, stale Reversal und Frozen Challenges.
    - Prüfe, dass Source Domain-Evidence nach Gamification-Fehlern erhalten bleibt.
    - **Property:** „For all valid Evidence and authoritative rows, repeating Reconciliation creates no additional grant, unlock, day, or challenge contribution.“
    - **Validiert:** Design Property 21; Requirements 19.7–19.17, 20.15–20.23, 22.1–22.9.
    - **Verifikation:** `bun run test <Reconciliation-Testdatei>` mit mindestens 100 Iterationen für den reinen Reconciler.
    - **Abhängigkeit:** 12.2.

- [ ] 13. Personal Contributions, XP und Achievements implementieren
  - Dieser Schritt faltet bestätigte eigene Outcomes in private accountweite Fortschritte.
  - **Voraussetzung:** Tasks 11 und 12.
  - **Parallelisierbarkeit:** Kann nach Task 12 parallel zu Task 14 beginnen. Task 15 benötigt die Projection-Verträge.
  - **Risiko:** Abgeleitete Zeilen dürfen nie direkt vom Client geschrieben werden.

  - [ ] 13.1 Contribution-, XP- und Achievement-Folds mit unveränderlichen Regeln implementieren
    - Erzeuge eine Personal Contribution nur bei aktivem Outcome, gültiger Household Participation, gültiger Personal Participation und eigenem Akteur.
    - Halte Contributions accountwide, auch bei mehreren Haushalten.
    - Führe `source-outcome-xp` Version 1 mit genau 10 XP für alle sechs Source Types ein.
    - Verknüpfe jeden Grant genau mit einer aktiven privaten Source oder Personal Contribution.
    - Neutralisiere Grants bei Reversal und reaktiviere denselben Grant bei Restoration.
    - Seed `first-outcome`, `household-helper-10` und `meal-logger-7` mit unveränderlichen Versionen und Source-Allowlist.
    - Führe Achievement States für aktive logische Outcomes und definierte Schwellen.
    - Erzeuge keine XP für Achievement- oder Challenge-Abschlüsse.
    - **Akzeptanz:** XP-Balance ist die Summe aktiver Grants. Achievement-States bleiben pro Definition und Version eindeutig.
    - **Verifikation:** Fold-Tests prüfen private Sichtbarkeit, Rule-Version, Reversal, Restoration, Schwellen und Null-XP-Nebenwirkungen.
    - **Dateien:** Personal-Projection-Domain, XP- und Achievement-Queries, Server-Fold und Definitions-Seeds.
    - **Requirements:** 8.6–8.10, 9.1–9.18, 10.1–10.20, 17.4–17.8.
    - **Abhängigkeit:** 12.2.

  - [ ]* 13.2 **Property 6: Personal Contributions bleiben accountweit privat** testen
    - Erzeuge Household Outcomes mit getrennten Personal- und Household-Participation-Intervallen.
    - Prüfe Contributions nur für den eigenen erfolgreichen Akteur mit beiden gültigen Participation-Zuständen.
    - Prüfe Household-Wechsel, Opt-out, Membership loss und fremde Accounts.
    - **Property:** „For all Household Outcomes, an own active contribution exists only when both required Participation states were active at occurrence time.“
    - **Validiert:** Design Property 6; Requirements 8.6–8.10, 8.19–8.21, 14.2–14.8, 17.3–17.6, 18.3–18.4, 18.11–18.12.
    - **Verifikation:** `bun run test <Contribution-Testdatei>` mit mindestens 100 Iterationen.
    - **Abhängigkeit:** 13.1.

  - [ ]* 13.3 **Property 7: XP-Ledger bleibt versioniert und summierbar** testen
    - Erzeuge aktive und reversed Sources mit mehreren Rule-Versionen.
    - Prüfe genau einen Grant je Account, Source-Referenz, Rule ID und Rule Version.
    - Prüfe Reversal, Restoration, historische Werte, 10-XP-Regel und Null-XP für Achievements und Challenges.
    - **Property:** „For all active private sources and contributions, the XP balance equals active grants without duplicate restoration grants.“
    - **Validiert:** Design Property 7; Requirements 9.1–9.18.
    - **Verifikation:** `bun run test <XP-Fold-Testdatei>` mit mindestens 100 Iterationen.
    - **Abhängigkeit:** 13.1.

  - [ ]* 13.4 **Property 8: Achievement-State folgt aktiven Schwellen** testen
    - Erzeuge aktive logische Outcomes, Reversal und Restoration für jede Definition-Version.
    - Prüfe Unlock ab Schwelle, Lock unter Schwelle und Re-aktivierung desselben States.
    - Prüfe keine Wiederholung von Unlock-Feedback und keine Mutation geschlossener Definition-Versionen.
    - **Property:** „For all definition versions, active logical progress unlocks at threshold and reversal or restoration reuses the same state.“
    - **Validiert:** Design Property 8; Requirements 10.1–10.20.
    - **Verifikation:** `bun run test <Achievement-Fold-Testdatei>` mit mindestens 100 Iterationen.
    - **Abhängigkeit:** 13.1.

- [ ] 14. Personal Active Days, Streaks und Protection implementieren
  - Dieser Schritt berechnet accountweite Tagesfolgen nur aus bestätigten persönlichen Quellen.
  - **Voraussetzung:** Tasks 11 bis 13.
  - **Parallelisierbarkeit:** 14.1 kann nach Task 12 parallel zu 13.1 laufen. Tests folgen dem Fold.
  - **Risiko:** Protection darf Aktivität oder XP nicht künstlich erhöhen.

  - [ ] 14.1 Active-Day-, Streak- und Protection-Fold implementieren
    - Erzeuge Personal Active Days aus aktiven eigenen Contributions und privaten Meal Logs.
    - Dedupliziere mehrere Quellen auf demselben Account Day.
    - Berechne Current Streak, Best Streak und Missed Days anhand der Account Timezone-Version.
    - Verteile zwei Protected Days pro Account-Time-Zone-Monat ohne Übertrag.
    - Begrenze Schutz auf zwei aufeinanderfolgende Missed Days.
    - Lasse Protection eine Folge erhalten, aber Current, Best, XP, Achievements, Challenges und Household Progress unverändert.
    - Führe Reversal und Restoration chronologisch und wiederholbar zurück in den Fold.
    - Beende Current Streak bei Opt-out ohne Protection-Verbrauch und starte bei Re-enable mit null.
    - **Akzeptanz:** Best Streak folgt den aktiven Outcomes, bestätigten Participation-Intervallen und Schutzregeln.
    - **Verifikation:** Pure Fold-Tests prüfen Monatsgrenzen, Tageswechsel, Reversal, Restoration, Opt-out und Protection.
    - **Dateien:** Personal-Progress-Domain, Streak- und Protection-Fold sowie Projection Queries.
    - **Requirements:** 14.1–14.27, 20.1–20.9.
    - **Abhängigkeit:** 12.2 und 13.1.

  - [ ]* 14.2 **Property 12: Personal Active Days deduplizieren Outcomes** testen
    - Erzeuge mindestens 100 Mengen aktiver privater Sources und Contributions.
    - Prüfe genau einen Day-Key je Account Day und keine zusätzliche Aktivität durch neue Source Types am selben Tag.
    - Prüfe Reversal bei verbleibender aktiver Quelle und Restoration ohne zweiten Day-Key.
    - **Property:** „For all active personal sources, multiple qualifying outcomes on one Account Day produce exactly one Personal Active Day.“
    - **Validiert:** Design Property 12; Requirements 14.1–14.17, 21.9–21.15.
    - **Verifikation:** `bun run test <Active-Day-Testdatei>` mit mindestens 100 Iterationen.
    - **Abhängigkeit:** 14.1.

  - [ ]* 14.3 **Property 13: Protection bewahrt Folgen ohne Aktivität zu erzeugen** testen
    - Erzeuge mindestens 100 chronologische Account-Day-Sequenzen mit Monatsgrenzen und Missed Days.
    - Prüfe monatliche Limits, maximal zwei aufeinanderfolgende Protected Days und Ablauf ohne Übertrag.
    - Prüfe unveränderte Current- und Best-Werte durch Protection sowie null XP, Achievements, Challenges und Household Progress.
    - **Property:** „For all chronological Account-Day sequences, protection uses monthly limits and never increases Current Streak, Best Streak, XP, or progress.“
    - **Validiert:** Design Property 13; Requirements 14.18–14.27, 14.31–14.32.
    - **Verifikation:** `bun run test <Protection-Testdatei>` mit mindestens 100 Iterationen.
    - **Abhängigkeit:** 14.1.

- [ ] 15. Private und Household Challenges sowie Household Progress implementieren
  - Dieser Schritt baut unveränderliche Challenge-Snapshots und privacy-minimierte Wochenaggregate.
  - **Voraussetzung:** Tasks 11 bis 14.
  - **Parallelisierbarkeit:** 15.1 und 15.2 sind getrennte Projektionen. Die Tests folgen beiden Implementierungen.
  - **Risiko:** Frozen Snapshots dürfen durch spätere Reconciliation nicht verändert werden.

  - [ ] 15.1 Immutable Definition Snapshots und beide Challenge-State-Machines implementieren
    - Kopiere Definition, Version, Allowlist, Target, Unit, Zeitfenster und Timezone in jede Instance.
    - Implementiere `available`, `active`, `completed`, `left`, `cancelled` und `expired` nach Owner-Regeln.
    - Zähle Private Challenges nur aus eigenen privaten Outcomes und Personal Contributions.
    - Zähle Household Challenges nur aus fünf Household Source Types.
    - Implementiere Opt-in, Leave, Activate, Cancel, Reset und Ende mit Frozen Snapshot.
    - Ermögliche Reversal und Restoration nur vor dem Instance-Ende.
    - Verhindere XP aus Challenge-Abschlüssen.
    - Prüfe Admin-Rechte für Household-Aktionen und Participation für Sichtbarkeit und neue Beiträge.
    - **Akzeptanz:** Terminale Snapshots bleiben unter Reversal, Restoration, Opt-in, Reset und Sync unverändert.
    - **Verifikation:** State-Machine- und Fold-Tests prüfen Zeitfenster `[start, end)`, Reset, Membership und Gegenaktionen.
    - **Dateien:** Challenge-Domain, Definition- und Instance-Queries, Server-Commands und Projection-Fold.
    - **Requirements:** 11.1–11.27, 12.1–12.28.
    - **Abhängigkeit:** 13.1 und 14.1.

  - [ ] 15.2 Privacy-minimierte Household-Progress-Wochenprojektion implementieren
    - Berechne Montag-bis-Montag-Counts für die fünf Household Source Types.
    - Berechne distinct aktive Household Days.
    - Ignoriere reversed Outcomes und zähle restored Outcomes genau einmal.
    - Entferne Account IDs, Namen, Contributor Counts, Ränge, XP, Streaks und private Daten.
    - Entferne Recipe-Titel, Item-Namen, Mengen, Meal-Log-Details und Trackingdaten.
    - Zeige die Projektion nur aktuellen Mitgliedern mit enabled Household Participation.
    - **Akzeptanz:** Die Projektion beschreibt fehlende sichtbare Mitgliedzuordnung. Sie behauptet keine vollständige Anonymität.
    - **Verifikation:** DTO-, RLS- und Wochenfold-Tests prüfen Felder, Counts, Tage und Opt-out-Verhalten.
    - **Dateien:** Household-Progress-Domain, Query-DTOs und Household-Projection-Tabellen.
    - **Requirements:** 12.5–12.7, 13.1–13.14, 17.7, 18.1–18.3.
    - **Abhängigkeit:** 13.1 und 14.1.

  - [ ]* 15.3 **Property 9: Private Challenge zählt nur das eigene Zeitfenster** testen
    - Erzeuge mindestens 100 private Challenge Instances mit immutablem Snapshot und variablen eigenen Quellen.
    - Prüfe nur erlaubte aktive Quellen im halb-offenen Intervall `[start, end)`.
    - Prüfe, dass fremde Accounts, Household Aggregate und Quellen vor dem Start nicht zählen.
    - Prüfe Freeze bei Ende, Leave, Opt-out, Reset, Reversal und Restoration.
    - **Property:** „For all Private Challenge Instances, progress counts only own allowed active sources in the immutable half-open interval `[start, end)`.“
    - **Validiert:** Design Property 9; Requirements 11.1–11.27.
    - **Verifikation:** `bun run test <Private-Challenge-Testdatei>` mit mindestens 100 Iterationen.
    - **Abhängigkeit:** 15.1.

  - [ ]* 15.4 **Property 10: Household Challenge bleibt aggregiert und eingefroren** testen
    - Erzeuge mindestens 100 Household Challenge Instances mit erlaubten und unerlaubten Quellen.
    - Prüfe nur Household Outcomes, keine privaten Meal Logs, XP oder Achievements.
    - Prüfe fehlende Contributor-Daten und terminale Freeze-Zustände unter späteren Source-Änderungen.
    - **Property:** „For all Household Challenge Instances, progress uses only allowed Household Outcomes and terminal snapshots remain unchanged.“
    - **Validiert:** Design Property 10; Requirements 12.1–12.28.
    - **Verifikation:** `bun run test <Household-Challenge-Testdatei>` mit mindestens 100 Iterationen.
    - **Abhängigkeit:** 15.1.

  - [ ]* 15.5 **Property 11: Household Progress zeigt nur Wochenaggregate** testen
    - Erzeuge mindestens 100 Household-Outcome-Mengen mit mehreren Accounts und Source Types.
    - Prüfe fünf Source-Type-Counts und genau einen distinct aktiven Tag je Household Day.
    - Prüfe fehlende Account IDs, Namen, per-member Counts, Ränge, private Daten und Raw Completion IDs.
    - **Property:** „For all Household Outcome sets, progress contains one count per source type and one distinct active-day count without member attribution.“
    - **Validiert:** Design Property 11; Requirements 13.1–13.14.
    - **Verifikation:** `bun run test <Household-Progress-Testdatei>` mit mindestens 100 Iterationen.
    - **Abhängigkeit:** 15.2.

- [ ] 16. Legacy-Streak-Migration und lokales Completion Feedback implementieren
  - Dieser Schritt behandelt den Legacy-Wert als einmalige private Startmarke und Feedback als lokale Installationseigenschaft.
  - **Voraussetzung:** Tasks 11 bis 14.
  - **Parallelisierbarkeit:** 16.1 und 16.2 können getrennt parallel bearbeitet werden. Tests folgen jeweils.
  - **Risiko:** Legacy-Werte dürfen nach der Entscheidung nicht erneut als laufender Streak gelesen werden.

  - [ ] 16.1 Legacy-Parser, Migration Decision, Snapshot und Cleanup implementieren
    - Validiere `count`, `best`, `lastDate`, Zukunftswerte und `count <= best`.
    - Verlange beim ersten Personal Setup genau eine Entscheidung `import` oder `restart`.
    - Fordere beim Import eine ausdrückliche Account-Bestätigung.
    - Speichere höchstens einen privaten Snapshot pro Account.
    - Erzeuge aus dem Snapshot keinen Source Outcome, Active Day, Grant, Unlock, Challenge-Progress oder Household Progress.
    - Implementiere Continuity Anchor für den aktuellen oder vorherigen Account Day.
    - Stoppe Runtime-Lese- und Schreibzugriffe nach lokaler Entscheidung.
    - Lösche `srf:cook-streak` erst nach bestätigter Synchronisation.
    - Bewahre den lokalen Wert bei unbekanntem Sync-Ergebnis und die Migration Decision bei Reset.
    - **Akzeptanz:** Import und Restart sind einmalig, privat, idempotent und erzeugen keine historische Source Evidence.
    - **Verifikation:** Parser-, Migration-, Reset-, Cleanup- und Multi-Device-Tests prüfen alle Legacy-Grenzen.
    - **Dateien:** Legacy-Domain, account-scoped Storage und Personal-Setup-Command.
    - **Requirements:** 14.28–14.33, 15.1–15.25.
    - **Abhängigkeit:** 11.2 und 14.1.

  - [ ] 16.2 Lokalen Feedback-Marker und einmaliges Completion Feedback verdrahten
    - Speichere den Marker vor sichtbarem oder haptischem Feedback.
    - Verwende den Schlüssel `(account_id, installation_id, logical_source_key)`.
    - Prüfe den Marker bei Restore, Pull, Retry, Realtime und Outbox Replay.
    - Erlaube je Installation höchstens ein Feedback für einen Logical Source Key.
    - Erlaube unabhängiges Feedback auf einer anderen Installation.
    - Lasse Feedback-Fehler Source Domain und Gamification-Projektion nicht blockieren.
    - Erzeuge keine neue Notification-Kampagne und verlange keine Animation.
    - **Akzeptanz:** Feedback erscheint höchstens einmal je Account, Installation und Logical Source Key.
    - **Verifikation:** Marker-Store-, Replay-, Restore- und Feedback-Fehlerpfade werden gezielt geprüft.
    - **Dateien:** Lokaler Feedback-Store, Completion-Feedback-Adapter und lokale Drizzle- oder MMKV-Grenze.
    - **Requirements:** 16.1–16.9, 19.30–19.32.
    - **Abhängigkeit:** 9.1 und 12.2.

  - [ ]* 16.3 **Property 14: Legacy Migration bleibt einmalig und privat** testen
    - Erzeuge mindestens 100 gültige, ungültige und fehlende Legacy-Snapshots.
    - Prüfe idempotente Entscheidungen, Account-Bestätigung, Continuity Anchor und fehlende historische Outcomes.
    - Prüfe Reset, spätere Geräte, Cleanup-Bestätigung und Sync-Fehler.
    - **Property:** „For all validated Legacy snapshots, the chosen migration decision is idempotent and creates no historical Source Outcome.“
    - **Validiert:** Design Property 14; Requirements 14.28–14.33, 15.1–15.25.
    - **Verifikation:** `bun run test <Legacy-Migration-Testdatei>` mit mindestens 100 Iterationen.
    - **Abhängigkeit:** 16.1.

  - [ ]* 16.4 **Property 15: Lokales Feedback bleibt installationsbezogen idempotent** testen
    - Erzeuge mindestens 100 Account-, Installation- und Logical-Source-Key-Tupel.
    - Prüfe genau einen Marker je Installation und unabhängige Marker für andere Installationen.
    - Prüfe Restore, Pull, Retry, Realtime, Outbox Replay und Achievement Re-unlock ohne Wiederholung.
    - **Property:** „For all Account, Installation, and Logical Source Key tuples, the marker permits feedback at most once per installation.“
    - **Validiert:** Design Property 15; Requirements 16.1–16.9, 19.30–19.32.
    - **Verifikation:** `bun run test <Feedback-Marker-Testdatei>` mit mindestens 100 Iterationen.
    - **Abhängigkeit:** 16.2.

- [ ] 17. Membership, Löschung, Reset, Accountwechsel und Export implementieren
  - Dieser Schritt setzt die unterschiedlichen Lebenszyklen von Account- und Household-Daten um.
  - **Voraussetzung:** Tasks 12 bis 16.
  - **Parallelisierbarkeit:** 17.1 und 17.2 können getrennt bearbeitet werden. Tests folgen nach beiden Implementierungen.
  - **Risiko:** Accountwechsel darf keine lokal lesbaren Daten des vorherigen Accounts offenlassen.

  - [ ] 17.1 Membership-, Delete-, Reset- und Account-Lifecycle-Commands implementieren
    - Blockiere neue Household Outcomes nach Membership loss und entferne Household-Views nach autoritativem Refresh.
    - Bewahre akzeptierte Household Outcomes ohne sichtbare Contributor-Beziehung.
    - Bewahre private Contributions und private Fortschritte des ehemaligen Accounts.
    - Lösche bei Household Deletion Evidence, Outcomes, Challenges und Progress.
    - Reversiere verknüpfte Contributions vor Household-Löschung und neutralisiere allein abhängige Grants.
    - Halte Frozen Challenge Snapshots unverändert.
    - Lösche bei Account Deletion alle Account-owned Gamification-Daten und private Contributor Links.
    - Bewahre Household-owned Outcomes bei Account Deletion.
    - Implementiere Personal Progress Reset mit disabled Participation, gelöschten privaten Projektionen und bewahrter Migration Decision.
    - Schließe die alte Account-Datenbank vor dem Öffnen einer neuen und stoppe Sync beim Sign-out.
    - Schütze nicht bestätigte Outbox-Arbeit und entferne danach lokal lesbare Daten des alten Accounts.
    - **Akzeptanz:** Membership loss, Household deletion, Account deletion, Reset, Sign-out und Accountwechsel folgen den Besitzgrenzen.
    - **Verifikation:** Lifecycle-Integrationstests prüfen Reihenfolge, Retention, lokale Bereinigung und Frozen Snapshots.
    - **Dateien:** Account-Lifecycle, Household-Lifecycle, Sync-Session und Reset-Commands.
    - **Requirements:** 8.13–8.30, 18.1–18.17, 19.20–19.22.
    - **Abhängigkeit:** 12.2, 15.1, 16.1.

  - [ ] 17.2 Persönlichen Export um Gamification-Daten erweitern
    - Exportiere Participation, Intervals, Timezone-Versionen und Opt-out-/Reset-Zustand.
    - Exportiere private Source Outcomes, eigene Contributions, XP, Achievement States und Private Challenge Instances.
    - Exportiere Frozen Snapshots, Current, Best, Protection, Protected Days, Legacy Snapshot und Migration Decision.
    - Schließe fremde Account-Daten und Household Source Evidence aus.
    - Halte das bestehende Exportformat und seine Secret-Grenzen ein.
    - **Akzeptanz:** Ein persönlicher Export enthält alle vorgeschriebenen privaten Daten und keine fremden oder validierungsinternen Daten.
    - **Verifikation:** Export-Integrationstests prüfen vollständige Felder, Besitzgrenzen und Reset-Zustände.
    - **Dateien:** `src/features/settings/data-export.ts` und Export-Serializer.
    - **Requirements:** 18.18–18.22.
    - **Abhängigkeit:** 13.1, 15.1, 16.1.

  - [ ]* 17.3 **Property 17: Lifecycle-Aktionen respektieren Eigentümer** testen
    - Erzeuge mindestens 100 Kombinationen aus Reset, Deletion, Membership loss und Export.
    - Prüfe Retention von Household Outcomes, Löschung privater Daten und unveränderte Frozen Snapshots.
    - Prüfe, dass Exporte nur autorisierte private Daten enthalten.
    - **Property:** „For all reset, deletion, membership-loss, and export operations, private and Household-owned data follow their distinct retention rules.“
    - **Validiert:** Design Property 17; Requirements 18.5–18.22.
    - **Verifikation:** `bun run test <Lifecycle-Testdatei>` mit mindestens 100 Iterationen für den reinen Retention-Fold und gezielten DB-Beispielen.
    - **Abhängigkeit:** 17.1 und 17.2.

  - [ ]* 17.4 Lifecycle- und Export-Integrationstests ergänzen
    - Prüfe Account deletion, Household deletion, Progress Reset, Membership Refresh, Sign-out und Accountwechsel mit lokalen Spiegeln.
    - Prüfe, dass fremde Account-Daten und Household Evidence nicht im Personal Export erscheinen.
    - **Verifikation:** `bun run test:db <Lifecycle-pgTAP-Test>` und `bun run test <Export-Testdatei>`.
    - **Requirements:** 18.1–18.22, 19.20–19.22.
    - **Abhängigkeit:** 17.1 und 17.2.

- [ ] 18. UI, Source-Command-Wiring und Ausschlüsse integrieren
  - Die UI zeigt nur autorisierte Projektionen und kennzeichnet ihren Bestätigungszustand.
  - **Voraussetzung:** Tasks 13 bis 17.
  - **Parallelisierbarkeit:** 18.1 und 18.2 benötigen beide die fertigen Projektionen. 18.3 folgt danach.
  - **Risiko:** UI-Aktionen dürfen keine Derived Rows direkt schreiben oder Source Domain-Ergebnisse blockieren.

  - [ ] 18.1 Opt-in-Setup, Personal Views und Household Views mit Zuständen implementieren
    - Erkläre vor dem Opt-in Quellen, Eigentümer, Sichtbarkeit, Aufbewahrung, Reset, Streak, Protection und Legacy.
    - Zeige Personal Views nur bei enabled Personal Participation.
    - Zeige Household Progress und Challenges nur bei Membership und enabled Household Participation.
    - Unterscheide `confirmed`, `provisional`, `rejected` und `unavailable` sichtbar.
    - Halte Settings-Links bei Opt-out sichtbar und ändere bei unavailable keine Source Domain-Daten.
    - Zeige Household Progress ohne Contributor-Zuordnung und ohne private Details.
    - Nutze React Query für Projection-Zustand und Zustand nur für lokale UI-Zustände.
    - Nutze ausschließlich Unistyles v3, Theme-Owner und bestehende UI-Primitiven.
    - **Akzeptanz:** Jede sichtbare Projektion folgt Membership, Participation, Ownership und Status.
    - **Verifikation:** Gezielte UI-Tests prüfen Opt-in, Opt-out, Membership loss, Statusfarben oder Labels und unavailable.
    - **Dateien:** `src/features/gamification/` Screens, Components, Hooks und Setup-Flows.
    - **Requirements:** 8.5–8.22, 12.19–12.24, 13.8–13.14, 17.6–17.13.
    - **Abhängigkeit:** 13.1, 15.2, 16.1 und 17.1.

  - [ ] 18.2 Sichtbare Aktionen, Gegenaktionen und Source Commands verdrahten
    - Verdrahte Enable, Disable, Re-enable, Challenge Start, Leave, Reset, Activate und Cancel.
    - Erzeuge zu jeder sichtbaren Aktion den spezifizierten fachlichen Gegenweg.
    - Ersetze alle direkten `recordActivity()`-Aufrufer durch Source Commands.
    - Leite Completion Feedback über den Marker-Store und nicht über UI-Mounts.
    - Verhindere direkte Writes in XP, Achievement States, Challenge Progress, Streak oder Protection.
    - Halte Source Domain-Completion unabhängig von Feedback-, Projection- und UI-Fehlern.
    - **Akzeptanz:** Jede UI-Aktion nutzt einen autoritativen Command oder eine zulässige eigene Instance-Aktion.
    - **Verifikation:** Action- und Counteraction-Tests prüfen Operation IDs, Reversals, Restorations und Fehlerisolierung.
    - **Dateien:** Source-Adapter-Aufrufer, Gamification-Screens, Hooks und Command-Clients.
    - **Requirements:** 1.2–1.7, 8.11–8.30, 11.7–11.27, 12.8–12.28, 16.1–16.9, 22.1–22.5.
    - **Abhängigkeit:** 18.1 und Tasks 2.1 bis 7.1.

  - [ ]* 18.3 **Property 20: Ausgeschlossene Quellen bleiben wirkungslos** als Adapter- und UI-Property testen
    - Erzeuge mindestens 100 ausgeschlossene Ereignisse aus Gewicht, Workouts, Fasten, Child Profiles, App-Öffnungen, Navigation, Screen Views, Taps und lokalen UI-Zuständen.
    - Prüfe keine Source Outcomes, XP, Achievements, Challenge-Progress, Streaks oder Household Progress.
    - Prüfe zusätzlich, dass Recipe Edits, Food Entry Rows, generisches `out`, Undo, Restore, Reopen und Plan-Inhalte nicht doppelt zählen.
    - Prüfe, dass Cooking und Private Meal Log nur mit unterschiedlichen Source Types und Completion IDs zwei Outcomes erzeugen dürfen.
    - **Property:** „For all excluded events, the Gamification System creates no Source Outcome, XP, Achievement, Challenge progress, Streak, or Household Progress.“
    - **Validiert:** Design Property 20; Requirements 21.1–21.19.
    - **Verifikation:** `bun run test <Exclusion-Testdatei>` mit mindestens 100 Iterationen für den reinen Adapter-Fold.
    - **Abhängigkeit:** 18.2.

- [ ] 19. Finaler Checkpoint: Release-Gates und gezielte Verifikation abschließen
  - **Akzeptanz:** Alle sechs Source Types besitzen stabile IDs, Evidence, Gegenwege und serverbestätigte Projektionen.
  - **Akzeptanz:** Alle synchronisierten Entitys besitzen Backend-Schema, RLS, SQLite-Spiegel, Migration, Entity-Metadaten, Outbox, Pull und Reconciliation.
  - **Akzeptanz:** Participation, Timezone-Versionen, XP, Achievements, Challenges, Progress, Streaks und Protection nutzen nur bestätigte Intervalle.
  - **Akzeptanz:** Frozen Challenge Snapshots, Besitzgrenzen, Export, Reset, Löschung, Legacy und lokales Feedback erfüllen den Vertrag.
  - **Verifikation:** Führe alle fokussierten Unit-, Property-, pgTAP-, Sync- und UI-Tests aus.
  - **Verifikation:** Prüfe jede Correctness Property mit mindestens 100 Iterationen, sofern sie reine Fold- oder Validatorlogik nutzt.
  - **Verifikation:** Führe `bun run typecheck`, `bun run check` und `git diff --check` aus.
  - **Verifikation:** Verwende niemals `bun test` und keine vollständige Testsuite.
  - **Verifikation:** Vor dem finalen Check-Lauf gilt exakt: "I'm going over the product once more before the final check run, looking for anything a strict evaluator would catch."
  - **Abhängigkeit:** 18.3, 17.4, 16.4, 15.5, 14.3, 13.4, 12.4, 11.7 und 10.

## Notes

- Die Reihenfolge folgt den Design-Stufen: Source-Prerequisites, Backend, Local-first, Commands, Fold, Challenges, Lifecycle und UI.
- Source-Prerequisites dürfen parallel entstehen, weil sie unterschiedliche fachliche Dateien und Aggregate besitzen.
- Shared Types, Backend-Schema, lokale Registry und autoritative Commands bilden harte Voraussetzungen.
- Die Task-Abhängigkeiten verhindern parallele Schreibzugriffe auf dieselben Dateien.
- Property-Aufgaben bleiben nahe an ihrer jeweiligen Implementierung.
- Reine Fold- und Validator-Properties nutzen mindestens 100 Iterationen.
- Supabase, SQLite, Realtime und externe Dienste erhalten deterministische Integrations- oder pgTAP-Beispiele.
- Testaufgaben mit `*` sind optional markiert. Die Release-Gates verlangen ihre Ergebnisse trotzdem für eine vollständige Abnahme.
- Jede sichtbare Aktion erhält einen fachlichen Gegenweg.
- `source_history`, Telemetrie, alte Kochzustände, Dashboards und Legacy-Werte dürfen keine rückwirkenden Outcomes erzeugen.
- Ein fehlendes Design- oder Requirements-Kriterium wird nicht stillschweigend ergänzt.
- Die Task-Datei ändert weder Produktcode noch Datenbankschema noch Laufzeitdaten.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "3.1", "4.1", "5.1", "6.1", "7.1", "8.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "4.2", "5.2", "6.2", "7.2", "8.2"] },
    { "id": 3, "tasks": ["8.3", "9.1"] },
    { "id": 4, "tasks": ["9.2"] },
    { "id": 5, "tasks": ["9.3"] },
    { "id": 6, "tasks": ["10"] },
    { "id": 7, "tasks": ["11.1"] },
    { "id": 8, "tasks": ["11.2"] },
    { "id": 9, "tasks": ["11.3", "11.4", "11.5", "11.6", "11.7"] },
    { "id": 10, "tasks": ["12.1"] },
    { "id": 11, "tasks": ["12.2"] },
    { "id": 12, "tasks": ["12.3", "12.4"] },
    { "id": 13, "tasks": ["13.1", "14.1"] },
    { "id": 14, "tasks": ["13.2", "13.3", "13.4", "14.2", "14.3"] },
    { "id": 15, "tasks": ["15.1", "15.2"] },
    { "id": 16, "tasks": ["15.3", "15.4", "15.5"] },
    { "id": 17, "tasks": ["16.1", "16.2"] },
    { "id": 18, "tasks": ["16.3", "16.4"] },
    { "id": 19, "tasks": ["17.1", "17.2"] },
    { "id": 20, "tasks": ["17.3", "17.4"] },
    { "id": 21, "tasks": ["18.1"] },
    { "id": 22, "tasks": ["18.2"] },
    { "id": 23, "tasks": ["18.3"] },
    { "id": 24, "tasks": ["19"] }
  ]
}
```
