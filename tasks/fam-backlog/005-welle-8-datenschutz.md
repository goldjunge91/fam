# 005: Welle 8 — Datenschutz & Compliance (#96–99)

**Status**: completed
**Created**: 2026-08-08
**Completed**: 2026-08-12
**Priority**: low

## Description

Mit dieser Welle ist laut `docs/ROADMAP.md` der MVP komplett.

## Action Items

- [x] `#96` Datenschutzerklärung (Verschlüsselung) — `docs/DATENSCHUTZ.md` +
      `/settings/privacy`, README korrigiert
- [x] `#97` Datenexport — `/settings/export`, JSON via `expo-sharing`,
      seitenweise Abfrage für große Tabellen
- [x] `#98` Account- und Datenlöschung — Edge Function `delete-account`
      (Service-Role) + RPC `prepare_account_deletion()`; dabei einen
      vorbestehenden Bug in `guard_last_admin` gefunden und behoben (siehe
      `docs/ROADMAP.md`, Welle 8)
- [x] `#99` App-Store-Privacy-Labels — `docs/PRIVACY_LABELS.md`,
      `app.json` bereinigt (ungenutzte `microphonePermission` entfernt)

## Notes

Neue Migration `welle8_account_deletion`, neue pgTAP-Assertions in
`03_households.test.sql` (15 → 22), `bun run db:diff` leer, `bun run test:db`
und `bun run test` grün, `bun run typecheck`/`bun run check` grün.
