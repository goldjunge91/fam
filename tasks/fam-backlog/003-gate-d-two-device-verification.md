# 003: Gate D — Zwei-Geräte-Sync verifizieren (#70)

**Status**: pending
**Created**: 2026-08-08
**Priority**: medium

## Description

Kein Coding-Task, sondern manuelle QA — der letzte offene Punkt aus Welle 2
(Offline & Sync) und Gate D für Welle 5. Voraussetzung:
`002-sync-engine-realtime-wiring.md` sollte zuerst erledigt sein, sonst
lässt sich das "<1s"-Ziel gar nicht erfüllen (nur Poll-Sync alle 20s aktiv).

## Action Items

- [ ] Zwei Simulatoren/Emulatoren gleichzeitig starten (per `argent`
      MCP-Tooling möglich)
- [ ] Beide Geräte im selben Haushalt anmelden
- [ ] Änderung auf Gerät A vornehmen, prüfen dass sie < 1s später auf
      Gerät B ankommt
- [ ] Gerät B offline schalten, dort ändern, wieder online bringen,
      Konvergenz prüfen (kein Datenverlust, keine Duplikate)
- [ ] Ergebnis in `docs/ROADMAP.md` als Gate D ✅ vermerken

## Notes

Blockiert von `002-sync-engine-realtime-wiring.md`.
