# 002: Realtime-Bridge (#48) + Netzwerk-/Hintergrund-Trigger (#50) anschliessen

**Status**: completed
**Created**: 2026-08-08
**Priority**: high

## Description

Beim Doku-Refresh (`tasks/fam-housekeeping/004-docs-refresh.md`) aufgefallen:
`src/app/(app)/_layout.tsx` ruft `useSyncEngine()` aus
`src/lib/sync/sync-runner.ts` auf — das ist reiner **Poll-Sync** (initial +
alle 20s + bei `AppState === 'active'`). Die bereits fertig gebauten und
getesteten Funktionen `subscribeHouseholdRealtime()` (#48, Realtime→SQLite-
Bridge) sowie `startNetworkReconnectTrigger()`/`registerBackgroundSync()`
(#50) werden von **nirgendwo** im App-Code aufgerufen — Details und
Design-Entscheidungen stehen als Doc-Comments direkt in `src/lib/sync/realtime.ts`,
`src/lib/sync/network-trigger.ts` und `src/lib/sync/background-sync.ts`
(`docs/SYNC_ENGINE.md` existiert in diesem Repo nicht).

Solange das so bleibt, konvergieren Änderungen zwischen Geräten nur alle
~20s statt in Echtzeit.

## Action Items

- [x] `subscribeHouseholdRealtime()` in `(app)/_layout.tsx` (oder einem
      passenden Provider) für den aktiven Haushalt abonnieren, inkl.
      sauberem Unsubscribe bei Haushaltswechsel/Unmount
- [x] `startNetworkReconnectTrigger()` verdrahten, Callback = `triggerHouseholdSync`
- [x] `registerBackgroundSync()` + `setBackgroundSyncHandler()` verdrahten
      (inkl. `defineBackgroundSyncTask()` im Modul-Scope von `src/app/_layout.tsx`,
      ohne die schlaegt `registerTaskAsync` zur Laufzeit fehl)
- [ ] Manuell verifizieren, dass kein Echo/keine Sync-Schleife entsteht
      (Design dazu steht schon als Doc-Comment in `src/lib/sync/realtime.ts`,
      Abschnitt "Echo-Unterdrueckung") — steht noch aus, siehe Notes

## Notes

Blockiert eine sinnvolle Durchführung von
`003-gate-d-two-device-verification.md` — ohne Realtime-Bridge ist das
"<1s"-Konvergenzziel aus Gate D gar nicht erreichbar, nur das ~20s-Polling.

**Verdrahtung implementiert** (neuer Hook `useRealtimeSync` in
`src/lib/sync/sync-runner.ts`, aufgerufen aus `(app)/_layout.tsx`;
`defineBackgroundSyncTask()`/`registerBackgroundSync()` in `src/app/_layout.tsx`).
Lint/Typecheck sowie die bestehenden Regressionstests
(`realtime.integration.test.ts`, `reconnect.test.ts`) laufen weiter grün —
an den zugrundeliegenden, bereits getesteten Bausteinen wurde nichts
verändert. Die manuelle Zwei-Geräte-Verifikation (Echtzeit-Konvergenz <20s,
kein Echo/keine Schleife, Reconnect-Fall) aus dem letzten Action Item steht
noch aus und sollte vor Abschluss von `003-gate-d-two-device-verification.md`
nachgeholt werden.

Bekannte, nicht behobene Grenze (Eigenschaft des bestehenden
`background-sync.ts`-Designs, keine Regression durch diese Verdrahtung):
`setBackgroundSyncHandler` wird nur gesetzt, während `(app)/_layout.tsx`
mit React-Baum lebt. Weckt das OS die Hintergrund-Task in einem
vollständig beendeten App-Zustand (headless), ist unklar, ob Expos
Background-Task-Boot den React-Baum erneut mountet — dann wäre der
Handler-Slot wieder `null`.
