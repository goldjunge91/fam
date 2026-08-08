# 002: Realtime-Bridge (#48) + Netzwerk-/Hintergrund-Trigger (#50) anschliessen

**Status**: pending
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
Design-Entscheidungen in `docs/SYNC_ENGINE.md`.

Solange das so bleibt, konvergieren Änderungen zwischen Geräten nur alle
~20s statt in Echtzeit.

## Action Items

- [ ] `subscribeHouseholdRealtime()` in `(app)/_layout.tsx` (oder einem
      passenden Provider) für den aktiven Haushalt abonnieren, inkl.
      sauberem Unsubscribe bei Haushaltswechsel/Unmount
- [ ] `startNetworkReconnectTrigger()` verdrahten, Callback = `triggerHouseholdSync`
- [ ] `registerBackgroundSync()` + `setBackgroundSyncHandler()` verdrahten
- [ ] Manuell verifizieren, dass kein Echo/keine Sync-Schleife entsteht
      (Design dazu steht schon in `docs/SYNC_ENGINE.md`, Abschnitt "#48")

## Notes

Blockiert eine sinnvolle Durchführung von
`003-gate-d-two-device-verification.md` — ohne Realtime-Bridge ist das
"<1s"-Konvergenzziel aus Gate D gar nicht erreichbar, nur das ~20s-Polling.
