# 006: SQLite-Sperrfehler, Cross-Account-Datenleck und Zugriffslücken

**Status**: in_progress
**Created**: 2026-08-09
**Priority**: high

## Description

Aufgefallen bei der Zwei-Geräte-Verifikation aus
`002-sync-engine-realtime-wiring.md`. Fünf Befunde, die sich beim
Nachverfolgen als zusammenhängend herausstellten — vollständige Diagnose mit
Belegen in `docs/plans/fix-sqlite-locking-und-household-datenleck.md`.

Der Code ist behoben (`f58e3bf`); offen sind die Verifikation am Gerät und der
Push aufs verlinkte Projekt.

## Action Items

- [x] `SQLITE_BUSY` ("database is locked"): `db/serialize.ts` — eine
      Connection, `BEGIN IMMEDIATE`, serialisierte Zugriffe. Der
      `busy_timeout`-Einzeiler aus der ersten Analyse hätte nicht gereicht
      (Connection-Zustand, erreicht die Transaktions-Connections nicht, und
      `SQLITE_BUSY_SNAPSHOT` ruft den Busy-Handler gar nicht auf)
- [x] Cross-Account-Datenleck: nutzerspezifischer Query-Key
      `['households','by-user',userId]`, `resetQueries()` statt `clear()`,
      Eigentumsprüfung der lokalen DB im Öffnungs-Mutex von `getDatabase()`
- [x] Realtime-Channel-Kollision beim Remount (`cannot add postgres_changes
      callbacks … after subscribe()`)
- [x] `permission denied for function create_household`: Session-Guard für
      `(app)` und `/household/*`, Einstiegsentscheidung in
      `auth/app-entry.ts`
- [x] Mitgliedernamen sichtbar: RPC `household_member_profiles` gibt nur
      Anzeigename und Avatar heraus, `profiles` bleibt privat
- [ ] `bun run db:push` — die Migration
      `20260809195849_haushalts_mitglieder_profile.sql` ist nur lokal
      angewandt. Ohne Push zeigt die App gegen Remote weiterhin
      "Unbekanntes Mitglied", und der RPC-Aufruf schlägt dort fehl
- [ ] Verifikation am Gerät (gehört inhaltlich zu
      `003-gate-d-two-device-verification.md`): kein "database is locked" im
      Log, nach Nutzerwechsel sofort der neue Haushalt, keine RLS-Fehler in
      der Outbox

## Notes

Der aufschlussreichste Punkt für später: Test- und Produktionsadapter des
`SqlDatabase`-Ports hatten unterschiedliche Transaktionssemantik.
`test/node-sqlite-adapter.ts` fährt seit jeher `BEGIN IMMEDIATE` auf einer
Connection — genau die Semantik, die den Fehler nicht erzeugen kann —,
während die Produktion an `expo-sqlite` delegierte, das pro Transaktion eine
neue Connection mit deferred `BEGIN` öffnet. Daher 268 grüne Tests bei
reproduzierbarem Gerätefehler. `sqlite-locking.test.ts` hält den Unterschied
jetzt als ausführbaren Beleg fest.

Beim Push beachten (AGENTS.md): Auf dem Remote vergeben ALTER DEFAULT
PRIVILEGES `EXECUTE` an `anon` für jede neue public-Funktion. `bun run db:push`
prüft das anschließend selbst über `scripts/check-privileges.sh --linked` —
bei `create_household` und `redeem_invite` hat es schon zweimal zugeschlagen.
